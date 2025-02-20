import { join } from 'path';
import fs from 'fs';
import type { UUID } from './types';
import { logger } from './logger';

export interface IFileLoader {
    // Load knowledge content for a character
    loadKnowledge(characterId: UUID): Promise<string[]>;
    
    // Check if knowledge exists for a character
    hasKnowledge(characterId: UUID): Promise<boolean>;
}

// Node.js implementation
export class NodeFileLoader implements IFileLoader {
    constructor(private knowledgeRoot: string) {}

    private getKnowledgePath(characterId: UUID): string {
        return join(this.knowledgeRoot, `${characterId}.knowledge`);
    }

    async loadKnowledge(characterId: UUID): Promise<string[]> {
        const path = this.getKnowledgePath(characterId);
        try {
            const content = await fs.promises.readFile(path, 'utf-8');
            return content.split('\n').filter(line => line.trim().length > 0);
        } catch (error) {
            logger.error(`Error loading knowledge for ${characterId}:`, error);
            return [];
        }
    }

    async hasKnowledge(characterId: UUID): Promise<boolean> {
        const path = this.getKnowledgePath(characterId);
        try {
            await fs.promises.access(path);
            return true;
        } catch {
            return false;
        }
    }
}

// Browser implementation
export class BrowserFileLoader implements IFileLoader {
    constructor(private knowledgeMap: Map<UUID, string[]>) {}

    async loadKnowledge(characterId: UUID): Promise<string[]> {
        return this.knowledgeMap.get(characterId) || [];
    }

    async hasKnowledge(characterId: UUID): Promise<boolean> {
        return this.knowledgeMap.has(characterId);
    }
} 