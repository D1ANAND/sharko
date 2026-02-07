import { WebSocket } from 'ws';

export class YellowClient {
  private ws: WebSocket | null = null;
  private connected = false;
  
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
          console.log('📨 Yellow message:', msg.type);
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
