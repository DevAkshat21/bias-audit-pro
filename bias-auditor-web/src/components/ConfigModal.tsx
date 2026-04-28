import React, { useState } from 'react';
import { X, Shield, Target, ChevronRight } from 'lucide-react';

interface ConfigModalProps {
  columns: string[];
  onConfirm: (target: string, protectedAttrs: string[]) => void;
  onClose: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({ columns, onConfirm, onClose }) => {
  const [target, setTarget] = useState(columns[columns.length - 1] ?? '');
  const [protectedAttrs, setProtectedAttrs] = useState<string[]>([]);

  const toggleAttr = (attr: string) => {
    setProtectedAttrs(prev =>
      prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr]
    );
  };

  const canSubmit = !!target && protectedAttrs.length > 0;

  return (
    /* Backdrop — covers entire viewport via inline styles, not Tailwind */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal card — explicit width, not relying on Tailwind flex/max-w */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          width: '100%',
          maxWidth: '672px',
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', background: '#f6faff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#141d23', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={20} color="#022448" /> Configure Analysis
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#43474e' }}>
              Map your dataset columns for bias auditing.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ padding: '6px', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={20} color="#43474e" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Target column */}
          <section>
            <h3 style={{ margin: '0 0 14px', fontSize: '12px', fontWeight: 700, color: '#022448', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Target size={14} /> Select Target Column
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {columns.map(col => (
                <button
                  key={col}
                  onClick={() => setTarget(col)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    border: `1.5px solid ${target === col ? '#022448' : '#c4c6cf'}`,
                    background: target === col ? '#022448' : '#ffffff',
                    color: target === col ? '#ffffff' : '#141d23',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    textAlign: 'left',
                    wordBreak: 'break-word',
                  }}
                >
                  {col}
                </button>
              ))}
            </div>
          </section>

          {/* Protected attributes */}
          <section>
            <h3 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 700, color: '#022448', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={14} /> Select Protected Attributes
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#43474e', fontStyle: 'italic' }}>
              Select columns representing sensitive groups (e.g. race, gender, age).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {columns.map(col => {
                const isTarget = col === target;
                const isSelected = protectedAttrs.includes(col);
                return (
                  <button
                    key={col}
                    disabled={isTarget}
                    onClick={() => toggleAttr(col)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 500,
                      border: `1.5px solid ${isSelected ? '#2ECC71' : '#c4c6cf'}`,
                      background: isSelected ? '#2ECC71' : '#ffffff',
                      color: isSelected ? '#ffffff' : isTarget ? '#aaa' : '#141d23',
                      cursor: isTarget ? 'not-allowed' : 'pointer',
                      opacity: isTarget ? 0.35 : 1,
                      transition: 'all 0.15s',
                      textAlign: 'left',
                      wordBreak: 'break-word',
                    }}
                  >
                    {col}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 32px', borderTop: '1px solid #e2e8f0', background: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#ba1a1a' }}>
            {!canSubmit && 'Select a target and at least one protected attribute.'}
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={onClose}
              style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 700, color: '#43474e', background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              disabled={!canSubmit}
              onClick={() => onConfirm(target, protectedAttrs)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 24px',
                fontSize: '13px',
                fontWeight: 700,
                background: canSubmit ? '#022448' : '#c4c6cf',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit ? '0 2px 8px rgba(2,36,72,0.3)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              Start Analysis <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
