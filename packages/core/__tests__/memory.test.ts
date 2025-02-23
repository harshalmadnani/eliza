import { MemoryManager } from "../src/memory";
import { CacheManager, MemoryCacheAdapter } from "../src/cache";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { IAgentRuntime, Memory, UUID, ModelClass, KnowledgeMetadata, MemoryType } from "../src/types";
import type { Mock } from 'vitest';

describe("MemoryManager", () => {
    const TEST_UUID_1 = "123e4567-e89b-12d3-a456-426614174000" as UUID;
    const TEST_UUID_2 = "987fcdeb-51e4-3af2-b890-312345678901" as UUID;
    const AGENT_UUID = "abcdef12-3456-7890-abcd-ef1234567890" as UUID;
    const ROOM_UUID = "11111111-2222-3333-4444-555555555555" as UUID;

    let memoryManager: MemoryManager;
    let mockDatabaseAdapter: any;
    let mockRuntime: IAgentRuntime;

    beforeEach(() => {
        mockDatabaseAdapter = {
            getMemories: vi.fn(),
            createMemory: vi.fn(),
            removeMemory: vi.fn(),
            removeAllMemories: vi.fn(),
            countMemories: vi.fn(),
            getCachedEmbeddings: vi.fn(),
            searchMemories: vi.fn(),
            getMemoriesByRoomIds: vi.fn(),
            getMemoryById: vi.fn(),
        };

        mockRuntime = {
            databaseAdapter: mockDatabaseAdapter,
            cacheManager: new CacheManager(new MemoryCacheAdapter()),
            agentId: AGENT_UUID,
            useModel: vi.fn().mockResolvedValue([]),
        } as unknown as IAgentRuntime;

        memoryManager = new MemoryManager({
            tableName: "test",
            runtime: mockRuntime,
        });
    });

    describe("addEmbeddingToMemory", () => {
        it("should preserve existing embedding if present", async () => {
            const existingEmbedding = [0.1, 0.2, 0.3];
            const memory: Memory = {
                id: "test-id" as UUID,
                userId: "user-id" as UUID,
                agentId: "agent-id" as UUID,
                roomId: "room-id" as UUID,
                createdAt: Date.now(),
                content: { 
                    text: "test content",
                    metadata: {
                        type: "document" as MemoryType
                    }
                },
                embedding: existingEmbedding
            };

            const result = await memoryManager.addEmbeddingToMemory(memory);
            expect(result.embedding).toBe(existingEmbedding);
        });

        it("should throw error for empty content", async () => {
            const memory: Memory = {
                id: "test-id" as UUID,
                userId: "user-id" as UUID,
                agentId: "agent-id" as UUID,
                roomId: "room-id" as UUID,
                createdAt: Date.now(),
                content: { text: "" }
            };

            await expect(
                memoryManager.addEmbeddingToMemory(memory)
            ).rejects.toThrow(
                "Cannot generate embedding: Memory content is empty"
            );
        });
    });

    describe("getMemories", () => {
        it("should handle pagination parameters", async () => {
            const roomId = "test-room" as UUID;
            const start = 0;
            const end = 5;

            await memoryManager.getMemories({ 
                roomId, 
                start, 
                end,
                count: 10,
                unique: true,
                agentId: AGENT_UUID
            });

            expect(mockDatabaseAdapter.getMemories).toHaveBeenCalledWith({
                roomId,
                count: 10,
                unique: true,
                tableName: "test",
                agentId: AGENT_UUID,
                start,
                end,
            });
        });

        it("should get memories with agentId", async () => {
            await memoryManager.getMemories({
                roomId: ROOM_UUID,
                agentId: AGENT_UUID,
            });

            expect(mockDatabaseAdapter.getMemories).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomId: ROOM_UUID,
                    agentId: AGENT_UUID,
                    tableName: "test",
                })
            );
        });

        it("should get memories without agentId", async () => {
            await memoryManager.getMemories({
                roomId: ROOM_UUID,
            });

            expect(mockDatabaseAdapter.getMemories).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomId: ROOM_UUID,
                    agentId: undefined,
                    tableName: "test",
                })
            );
        });
    });

    describe("searchMemories", () => {
        const testEmbedding = [1, 2, 3];

        it("should search memories with agentId", async () => {
            await memoryManager.searchMemories({
                embedding: testEmbedding,
                roomId: ROOM_UUID,
                agentId: AGENT_UUID,
            });

            expect(mockDatabaseAdapter.searchMemories).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomId: ROOM_UUID,
                    agentId: AGENT_UUID,
                    embedding: testEmbedding,
                })
            );
        });

        it("should search memories without agentId", async () => {
            await memoryManager.searchMemories({
                embedding: testEmbedding,
                roomId: ROOM_UUID,
            });

            expect(mockDatabaseAdapter.searchMemories).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomId: ROOM_UUID,
                    agentId: undefined,
                    embedding: testEmbedding,
                })
            );
        });
    });

    describe("getMemoriesByRoomIds", () => {
        it("should get memories by room ids with agentId", async () => {
            await memoryManager.getMemoriesByRoomIds({
                roomIds: [TEST_UUID_1, TEST_UUID_2],
                agentId: AGENT_UUID,
            });

            expect(mockDatabaseAdapter.getMemoriesByRoomIds).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomIds: [TEST_UUID_1, TEST_UUID_2],
                    agentId: AGENT_UUID,
                })
            );
        });

        it("should get memories by room ids without agentId", async () => {
            await memoryManager.getMemoriesByRoomIds({
                roomIds: [TEST_UUID_1, TEST_UUID_2],
            });

            expect(mockDatabaseAdapter.getMemoriesByRoomIds).toHaveBeenCalledWith(
                expect.objectContaining({
                    roomIds: [TEST_UUID_1, TEST_UUID_2],
                    agentId: undefined,
                })
            );
        });
    });

    describe("Metadata Handling", () => {
        it("should add default metadata for knowledge table", async () => {
            const manager = new MemoryManager({
                tableName: "knowledge",
                runtime: mockRuntime,
            });

            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: { text: "test" },
            };

            await manager.createMemory(memory);

            expect(mockRuntime.databaseAdapter.createMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        metadata: expect.objectContaining({
                            type: "document",
                            source: "knowledge",
                            scope: "shared",
                            timestamp: expect.any(Number)
                        })
                    })
                }),
                "knowledge",
                false
            );
        });

        it("should validate metadata fields", async () => {
            const invalidMetadata: KnowledgeMetadata = {
                type: "invalid" as MemoryType,
            };

            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: { 
                    text: "test",
                    metadata: invalidMetadata
                }
            };

            await expect(memoryManager.createMemory(memory)).rejects.toThrow();
        });

        it("should set default scope based on agentId", async () => {
            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                agentId: AGENT_UUID,
                createdAt: Date.now(),
                content: { 
                    text: "test",
                    metadata: {
                        type: "document"
                    }
                }
            };

            await memoryManager.createMemory(memory);

            expect(mockRuntime.databaseAdapter.createMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        metadata: expect.objectContaining({
                            type: "document",
                            scope: "private",
                            source: "test"
                        })
                    })
                }),
                "knowledge",
                false
            );
        });

        it("should preserve existing metadata values", async () => {
            const existingMetadata: KnowledgeMetadata = {
                type: "document",
                sourceId: TEST_UUID_1,
                chunkIndex: 0,
                source: "custom",
                scope: "shared"
            };

            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: { 
                    text: "test",
                    metadata: existingMetadata
                }
            };

            await memoryManager.createMemory(memory);

            expect(mockRuntime.databaseAdapter.createMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        metadata: expect.objectContaining(existingMetadata)
                    })
                }),
                "knowledge",
                false
            );
        });
    });

    describe("Memory Type Handling", () => {
        it("should store documents in knowledge table", async () => {
            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: { 
                    text: "test",
                    metadata: {
                        type: "document"
                    }
                }
            };

            await memoryManager.createMemory(memory);

            expect(mockRuntime.databaseAdapter.createMemory).toHaveBeenCalledWith(
                expect.anything(),
                "knowledge",
                false
            );
        });

        it("should store fragments in knowledge table", async () => {
            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: { 
                    text: "test fragment",
                    metadata: {
                        type: "fragment",
                        sourceId: TEST_UUID_2
                    }
                }
            };

            await memoryManager.createMemory(memory);

            expect(mockRuntime.databaseAdapter.createMemory).toHaveBeenCalledWith(
                expect.anything(),
                "knowledge",
                false
            );
        });

        it("should set default type based on context", async () => {
            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: { text: "test" }
            };

            await memoryManager.createMemory(memory);

            expect(mockRuntime.databaseAdapter.createMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        metadata: expect.objectContaining({
                            type: "message" // Default for non-knowledge table
                        })
                    })
                }),
                expect.anything(),
                false
            );
        });

        // Error Cases
        it("should reject invalid memory types", async () => {
            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: { 
                    text: "test",
                    metadata: {
                        type: "invalid_type" as MemoryType, // Type assertion to bypass TS
                    }
                }
            };

            await expect(memoryManager.createMemory(memory)).rejects.toThrow('Invalid memory type');
        });

        it("should reject missing required type field", async () => {
            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: { 
                    text: "test",
                    metadata: {} as KnowledgeMetadata // Empty metadata
                }
            };

            await expect(memoryManager.createMemory(memory)).rejects.toThrow('Invalid memory type');
        });

        // Type-to-Table Mapping
        it("should map 'fact' type to facts table", async () => {
            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: { 
                    text: "test fact",
                    metadata: {
                        type: "fact"
                    }
                }
            };

            await memoryManager.createMemory(memory);

            expect(mockRuntime.databaseAdapter.createMemory).toHaveBeenCalledWith(
                expect.anything(),
                "facts",
                false
            );
        });

        it("should map 'message' type to messages table", async () => {
            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: { 
                    text: "test message",
                    metadata: {
                        type: "message"
                    }
                }
            };

            await memoryManager.createMemory(memory);

            expect(mockRuntime.databaseAdapter.createMemory).toHaveBeenCalledWith(
                expect.anything(),
                "messages",
                false
            );
        });

        // Metadata Inheritance
        it("should preserve metadata when creating fragments from documents", async () => {
            const documentMemory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: { 
                    text: "source document",
                    metadata: {
                        type: "document",
                        source: "custom",
                        scope: "shared"
                    }
                }
            };

            const fragmentMemory: Memory = {
                id: TEST_UUID_2,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: { 
                    text: "fragment content",
                    metadata: {
                        type: "fragment",
                        sourceId: documentMemory.id,
                        chunkIndex: 0,
                        source: documentMemory.content.metadata?.source,
                        scope: documentMemory.content.metadata?.scope
                    }
                }
            };

            await memoryManager.createMemory(fragmentMemory);

            expect(mockRuntime.databaseAdapter.createMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        metadata: expect.objectContaining({
                            type: "fragment",
                            sourceId: documentMemory.id,
                            source: "custom",
                            scope: "shared"
                        })
                    })
                }),
                "knowledge",
                false
            );
        });

        // Edge Cases
        it("should handle undefined metadata", async () => {
            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: { text: "test" }  // No metadata at all
            };

            await memoryManager.createMemory(memory);

            expect(mockRuntime.databaseAdapter.createMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        metadata: expect.objectContaining({
                            type: expect.any(String),
                            source: expect.any(String),
                            scope: expect.any(String),
                            timestamp: expect.any(Number)
                        })
                    })
                }),
                expect.any(String),
                false
            );
        });

        it("should handle minimal metadata", async () => {
            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: { 
                    text: "test",
                    metadata: {
                        type: "message"  // Only required field
                    }
                }
            };

            await memoryManager.createMemory(memory);

            expect(mockRuntime.databaseAdapter.createMemory).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.objectContaining({
                        metadata: expect.objectContaining({
                            type: "message",
                            source: expect.any(String),
                            scope: expect.any(String),
                            timestamp: expect.any(Number)
                        })
                    })
                }),
                "messages",
                false
            );
        });
    });
});

describe("Memory Types", () => {
    const TEST_UUID_1 = "123e4567-e89b-12d3-a456-426614174000" as UUID;
    const TEST_UUID_2 = "987fcdeb-51e4-3af2-b890-312345678901" as UUID;
    const AGENT_UUID = "abcdef12-3456-7890-abcd-ef1234567890" as UUID;
    const ROOM_UUID = "11111111-2222-3333-4444-555555555555" as UUID;

    describe("Memory Interface", () => {
        it("should allow creation with required fields", () => {
            const memory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: {
                    text: "test content"
                }
            };
            
            expect(memory).toBeDefined();
        });

        it("should allow optional agentId", () => {
            const withAgent: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                agentId: AGENT_UUID,
                createdAt: Date.now(),
                content: {
                    text: "test with agent"
                }
            };

            const withoutAgent: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: {
                    text: "test without agent"
                }
            };

            expect(withAgent.agentId).toBeDefined();
            expect(withoutAgent.agentId).toBeUndefined();
        });
    });

    describe("Knowledge Metadata", () => {
        it("should support document type metadata", () => {
            const documentMemory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: {
                    text: "document content",
                    metadata: {
                        type: "document" as MemoryType
                    }
                }
            };

            expect(documentMemory.content.metadata?.type).toBe("document");
        });

        it("should support fragment type with source reference", () => {
            const fragmentMemory: Memory = {
                id: TEST_UUID_1,
                userId: TEST_UUID_2,
                roomId: ROOM_UUID,
                createdAt: Date.now(),
                content: {
                    text: "fragment content",
                    metadata: {
                        type: "fragment" as MemoryType,
                        sourceId: TEST_UUID_2,
                        chunkIndex: 0
                    }
                }
            };

            expect(fragmentMemory.content.metadata?.type).toBe("fragment");
            expect(fragmentMemory.content.metadata?.sourceId).toBeDefined();
            expect(fragmentMemory.content.metadata?.chunkIndex).toBe(0);
        });
    });
});
