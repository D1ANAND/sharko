import { WebSocket } from 'ws';

export class YellowClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private sessionCallbacks: Map<string, (sessionId: string) => void> = new Map();

  connect() {
    if (this.connected) return;

    try {
      this.ws = new WebSocket('wss://clearnet-sandbox.yellow.com/ws');

      this.ws.on('open', () => {
        this.connected = true;
        console.log('🟡 Yellow Network connected');
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          console.log('📨 Yellow message:', msg.type || 'unknown');

          // Handle session responses
          if (msg.type === 'session_opened' && msg.sessionId) {
            const callback = this.sessionCallbacks.get(msg.requestId);
            if (callback) {
              callback(msg.sessionId);
              this.sessionCallbacks.delete(msg.requestId);
            }
          }
        } catch (e) {
          console.error('Yellow parse error:', e);
        }
      });

      this.ws.on('error', (err) => {
        console.error('Yellow error:', err.message);
      });

      this.ws.on('close', () => {
        this.connected = false;
        console.log('🟡 Yellow disconnected');
      });
    } catch (error) {
      console.error('Yellow connection failed:', error);
    }
  }

  /**
   * Open a Yellow Network session (state channel)
   */
  async openSession(userAddress: string, depositAmount: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.ws || !this.connected) {
        reject(new Error('Yellow not connected'));
        return;
      }

      const requestId = Math.random().toString(36).substring(7);
      const timeout = setTimeout(() => {
        this.sessionCallbacks.delete(requestId);
        reject(new Error('Yellow session open timeout'));
      }, 10000); // 10 second timeout

      this.sessionCallbacks.set(requestId, (sessionId: string) => {
        clearTimeout(timeout);
        resolve(sessionId);
      });

      const message = {
        type: 'open_session',
        version: '1.0',
        requestId,
        userAddress,
        depositAmount: depositAmount.toString(),
        timestamp: Date.now(),
      };

      try {
        this.ws.send(JSON.stringify(message));
        console.log('📤 Yellow session open request:', userAddress);
      } catch (error) {
        clearTimeout(timeout);
        this.sessionCallbacks.delete(requestId);
        reject(error);
      }
    });
  }

  /**
   * Close a Yellow Network session
   */
  async closeSession(yellowSessionId: string): Promise<void> {
    if (!this.ws || !this.connected) {
      console.warn('Yellow not connected, skipping session close');
      return;
    }

    const message = {
      type: 'close_session',
      version: '1.0',
      sessionId: yellowSessionId,
      timestamp: Date.now(),
    };

    try {
      this.ws.send(JSON.stringify(message));
      console.log('📤 Yellow session close:', yellowSessionId);
    } catch (error) {
      console.error('Yellow session close error:', error);
    }
  }

  /**
   * Send a bet message (off-chain state update)
   */
  send(bet: { marketId: string; side: boolean; amount: string; user: string }) {
    if (!this.ws || !this.connected) {
      console.warn('Yellow not connected, skipping send');
      return;
    }

    const message = {
      type: 'prediction_bet',
      version: '1.0',
      ...bet,
      timestamp: Date.now(),
      nonce: Math.random().toString(36)
    };

    try {
      this.ws.send(JSON.stringify(message));
      console.log('📤 Yellow bet relayed:', bet.marketId.slice(0, 8));
    } catch (error) {
      console.error('Yellow send error:', error);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.connected = false;
    }
  }
}

export const yellowClient = new YellowClient();
