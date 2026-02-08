// components/DepositModal.tsx
import React, { useState } from 'react';

interface Props {
  isOpen: boolean;
  onDeposit: (amount: string) => void;
  onCancel: () => void;
}

export function DepositModal({ isOpen, onDeposit, onCancel }: Props) {
  const [amount, setAmount] = useState('');

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2>Fund Your Channel</h2>
        <p>Enter amount to deposit into the State Channel:</p>
        <input 
          type="number" 
          value={amount} 
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (e.g. 100)"
          style={styles.input}
        />
        <div style={styles.buttons}>
          <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
          <button onClick={() => onDeposit(amount)} style={styles.confirmBtn}>
            Deposit & Start
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed' as 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
  },
  modal: {
    backgroundColor: '#1a1a1a', padding: '2rem', borderRadius: '12px', border: '1px solid #333',
    width: '350px', color: 'white'
  },
  input: {
    width: '100%', padding: '10px', margin: '15px 0', borderRadius: '4px',
    border: '1px solid #444', backgroundColor: '#333', color: 'white'
  },
  buttons: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  confirmBtn: { backgroundColor: '#fbbf24', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  cancelBtn: { backgroundColor: 'transparent', border: '1px solid #666', color: '#888', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }
};