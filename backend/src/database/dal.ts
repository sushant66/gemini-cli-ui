import { database } from './database.js';
import { ChatSession, ChatMessage, CodeBlock } from '../types/session.js';
import { v4 as uuidv4 } from 'uuid';

export interface DatabaseUser {
  id: string;
  name: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseChatSession {
  id: string;
  name: string;
  project_id?: string;
  user_id?: string;
  context_files: string; // JSON string
  working_directory: string;
  created_at: string;
  updated_at: string;
}

export interface DatabaseMessage {
  id: string;
  session_id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: string; // JSON string
  created_at: string;
}

export interface DatabaseCodeBlock {
  id: string;
  message_id: string;
  language: string;
  content: string;
  filename?: string;
  start_line?: number;
  end_line?: number;
  created_at: string;
}

export class DataAccessLayer {
  // User operations
  async createUser(user: Omit<DatabaseUser, 'created_at' | 'updated_at'>): Promise<void> {
    const sql = `
      INSERT INTO users (id, name, email)
      VALUES (?, ?, ?)
    `;
    await database.run(sql, [user.id, user.name, user.email || null]);
  }

  async getUserById(id: string): Promise<DatabaseUser | undefined> {
    const sql = 'SELECT * FROM users WHERE id = ?';
    return await database.get<DatabaseUser>(sql, [id]);
  }

  async getUserByEmail(email: string): Promise<DatabaseUser | undefined> {
    const sql = 'SELECT * FROM users WHERE email = ?';
    return await database.get<DatabaseUser>(sql, [email]);
  }

  // Chat session operations
  async createChatSession(session: ChatSession): Promise<void> {
    const sql = `
      INSERT INTO chat_sessions (
        id, name, project_id, user_id,
        context_files, working_directory
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await database.run(sql, [
      session.id,
      session.name,
      session.projectId || null,
      null, // user_id - will be set when user management is implemented
      JSON.stringify(session.context.files),
      session.context.workingDirectory
    ]);
  }

  async getChatSessionById(id: string): Promise<ChatSession | undefined> {
    const sql = 'SELECT * FROM chat_sessions WHERE id = ?';
    const dbSession = await database.get<DatabaseChatSession>(sql, [id]);
    
    if (!dbSession) {
      return undefined;
    }

    // Get messages for this session
    const messages = await this.getMessagesBySessionId(id);
    
    return this.mapDatabaseSessionToChatSession(dbSession, messages);
  }



  async updateChatSession(id: string, updates: Partial<ChatSession>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }

    if (updates.projectId !== undefined) {
      fields.push('project_id = ?');
      values.push(updates.projectId);
    }

    if (updates.context !== undefined) {
      if (updates.context.files !== undefined) {
        fields.push('context_files = ?');
        values.push(JSON.stringify(updates.context.files));
      }
      
      if (updates.context.workingDirectory !== undefined) {
        fields.push('working_directory = ?');
        values.push(updates.context.workingDirectory);
      }
    }

    if (fields.length === 0) {
      return; // No updates to make
    }

    values.push(id);
    const sql = `UPDATE chat_sessions SET ${fields.join(', ')} WHERE id = ?`;
    await database.run(sql, values);
  }

  async deleteChatSession(id: string): Promise<void> {
    // Messages and code blocks will be deleted automatically due to CASCADE
    const sql = 'DELETE FROM chat_sessions WHERE id = ?';
    await database.run(sql, [id]);
  }

  async listChatSessions(projectId?: string, limit?: number, offset?: number): Promise<ChatSession[]> {
    let sql = 'SELECT * FROM chat_sessions';
    const params: any[] = [];

    if (projectId) {
      sql += ' WHERE project_id = ?';
      params.push(projectId);
    }

    sql += ' ORDER BY updated_at DESC';

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
      
      if (offset) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }

    const dbSessions = await database.all<DatabaseChatSession>(sql, params);
    const sessions: ChatSession[] = [];

    for (const dbSession of dbSessions) {
      const messages = await this.getMessagesBySessionId(dbSession.id);
      sessions.push(this.mapDatabaseSessionToChatSession(dbSession, messages));
    }

    return sessions;
  }

  // Message operations
  async createMessage(message: ChatMessage, sessionId: string): Promise<void> {
    await database.transaction(async () => {
      // Insert message
      const messageSql = `
        INSERT INTO messages (id, session_id, type, content, timestamp, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      await database.run(messageSql, [
        message.id,
        sessionId,
        message.type,
        message.content,
        message.timestamp instanceof Date ? message.timestamp.toISOString() : new Date(message.timestamp).toISOString(),
        message.metadata ? JSON.stringify(message.metadata) : null
      ]);

      // Insert code blocks if any
      if (message.metadata?.codeBlocks) {
        for (const codeBlock of message.metadata.codeBlocks) {
          await this.createCodeBlock(codeBlock, message.id);
        }
      }
    });
  }

  async getMessageById(id: string): Promise<ChatMessage | undefined> {
    const sql = 'SELECT * FROM messages WHERE id = ?';
    const dbMessage = await database.get<DatabaseMessage>(sql, [id]);
    
    if (!dbMessage) {
      return undefined;
    }

    const codeBlocks = await this.getCodeBlocksByMessageId(id);
    return this.mapDatabaseMessageToChatMessage(dbMessage, codeBlocks);
  }

  async getMessagesBySessionId(sessionId: string): Promise<ChatMessage[]> {
    const sql = 'SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC';
    const dbMessages = await database.all<DatabaseMessage>(sql, [sessionId]);
    
    const messages: ChatMessage[] = [];
    
    for (const dbMessage of dbMessages) {
      const codeBlocks = await this.getCodeBlocksByMessageId(dbMessage.id);
      messages.push(this.mapDatabaseMessageToChatMessage(dbMessage, codeBlocks));
    }
    
    return messages;
  }

  async updateMessage(id: string, updates: Partial<ChatMessage>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.content !== undefined) {
      fields.push('content = ?');
      values.push(updates.content);
    }

    if (updates.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(JSON.stringify(updates.metadata));
    }

    if (fields.length === 0) {
      return;
    }

    values.push(id);
    const sql = `UPDATE messages SET ${fields.join(', ')} WHERE id = ?`;
    await database.run(sql, values);

    // Update code blocks if metadata changed
    if (updates.metadata !== undefined) {
      await this.deleteCodeBlocksByMessageId(id);
      
      if (updates.metadata.codeBlocks) {
        for (const codeBlock of updates.metadata.codeBlocks) {
          await this.createCodeBlock(codeBlock, id);
        }
      }
    }
  }

  async deleteMessage(id: string): Promise<void> {
    // Code blocks will be deleted automatically due to CASCADE
    const sql = 'DELETE FROM messages WHERE id = ?';
    await database.run(sql, [id]);
  }

  // Code block operations
  async createCodeBlock(codeBlock: CodeBlock, messageId: string): Promise<void> {
    const sql = `
      INSERT INTO code_blocks (id, message_id, language, content, filename, start_line, end_line)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await database.run(sql, [
      codeBlock.id,
      messageId,
      codeBlock.language,
      codeBlock.content,
      codeBlock.filename || null,
      codeBlock.startLine || null,
      codeBlock.endLine || null
    ]);
  }

  async getCodeBlocksByMessageId(messageId: string): Promise<CodeBlock[]> {
    const sql = 'SELECT * FROM code_blocks WHERE message_id = ? ORDER BY created_at ASC';
    const dbCodeBlocks = await database.all<DatabaseCodeBlock>(sql, [messageId]);
    
    return dbCodeBlocks.map(this.mapDatabaseCodeBlockToCodeBlock);
  }

  async deleteCodeBlocksByMessageId(messageId: string): Promise<void> {
    const sql = 'DELETE FROM code_blocks WHERE message_id = ?';
    await database.run(sql, [messageId]);
  }

  // Mapping functions
  private mapDatabaseSessionToChatSession(
    dbSession: DatabaseChatSession,
    messages: ChatMessage[]
  ): ChatSession {
    return {
      id: dbSession.id,
      name: dbSession.name,
      projectId: dbSession.project_id || undefined,
      messages,
      context: {
        files: JSON.parse(dbSession.context_files),
        workingDirectory: dbSession.working_directory
      },
      createdAt: new Date(dbSession.created_at),
      updatedAt: new Date(dbSession.updated_at)
    };
  }

  private mapDatabaseMessageToChatMessage(
    dbMessage: DatabaseMessage,
    codeBlocks: CodeBlock[]
  ): ChatMessage {
    const metadata = dbMessage.metadata ? JSON.parse(dbMessage.metadata) : undefined;
    
    if (metadata && codeBlocks.length > 0) {
      metadata.codeBlocks = codeBlocks;
    }

    return {
      id: dbMessage.id,
      type: dbMessage.type,
      content: dbMessage.content,
      timestamp: new Date(dbMessage.timestamp), // Convert string back to Date
      metadata
    };
  }

  private mapDatabaseCodeBlockToCodeBlock(dbCodeBlock: DatabaseCodeBlock): CodeBlock {
    return {
      id: dbCodeBlock.id,
      language: dbCodeBlock.language,
      content: dbCodeBlock.content,
      filename: dbCodeBlock.filename || undefined,
      startLine: dbCodeBlock.start_line || undefined,
      endLine: dbCodeBlock.end_line || undefined
    };
  }
}

// Export singleton instance
export const dal = new DataAccessLayer();