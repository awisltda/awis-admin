import { useMemo, useState } from 'react'
import { Button } from './Button'
import { Card } from './Card'
import { Badge } from './Badge'

export function SecretOneTimeModal(props: {
  open: boolean
  clientId: string
  clientSecret: string
  onCopy: (label: string, value: string) => void | Promise<void>
  onClose: () => void
}) {
  const { open, clientId, clientSecret, onCopy, onClose } = props
  const [reveal, setReveal] = useState(false)

  const masked = useMemo(() => {
    if (!clientSecret) return ''
    if (clientSecret.length <= 10) return '••••••••••'
    return `${clientSecret.slice(0, 4)}••••••••••••••••${clientSecret.slice(-4)}`
  }, [clientSecret])

  if (!open) return null

  return (
    <div className="awis-modal-backdrop" role="dialog" aria-modal="true" aria-label="clientSecret (exibição única)">
      <div className="awis-modal">
        <Card
          title="clientSecret (exibição única)"
          subtitle="Este valor será exibido somente agora. Copie e atualize o integrador imediatamente."
          right={
            <Badge variant="muted">
              EXIBIÇÃO ÚNICA
            </Badge>
          }
        >
          <div className="awis-modal-scroll">
            <div className="awis-stack" style={{ gap: 12 }}>
              <div className="awis-callout awis-callout--warn">
                <div style={{ fontWeight: 700 }}>Atenção</div>
                <div className="awis-muted" style={{ marginTop: 6 }}>
                  Ao rotacionar, o secret anterior fica inválido. Se o integrador não for atualizado, as chamadas irão falhar.
                </div>
              </div>

              <div className="awis-list" role="list">
                <div className="awis-list-item" role="listitem">
                  <div style={{ minWidth: 0 }}>
                    <div className="awis-list-title">clientId</div>
                    <div className="awis-muted" style={{ fontSize: 12 }}>
                      <span className="awis-mono">{clientId || '—'}</span>
                    </div>
                  </div>
                  <Button variant="ghost" onClick={() => onCopy('clientId', clientId)} disabled={!clientId}>
                    Copiar
                  </Button>
                </div>

                <div className="awis-list-item" role="listitem" style={{ alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="awis-list-title">clientSecret</div>
                    <div className="awis-muted" style={{ fontSize: 12, marginTop: 4 }}>
                      <span className="awis-mono" style={{ wordBreak: 'break-all', whiteSpace: 'normal' }}>
                        {reveal ? clientSecret : masked}
                      </span>
                    </div>

                    <div className="awis-row" style={{ gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                      <Button variant="ghost" onClick={() => setReveal((v) => !v)} disabled={!clientSecret}>
                        {reveal ? 'Ocultar' : 'Mostrar'}
                      </Button>
                      <Button
                        variant="primary"
                        onClick={() => onCopy('clientSecret', clientSecret)}
                        disabled={!clientSecret}
                        title="Copiar clientSecret"
                      >
                        Copiar clientSecret
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="awis-details">
                <div style={{ fontWeight: 700 }}>Sugestão operacional</div>
                <div className="awis-muted" style={{ marginTop: 6 }}>
                  Atualize o integrador (ex: .env / secret manager) e faça um teste rápido de autenticação antes de encerrar.
                </div>
              </div>

              <div className="awis-row" style={{ justifyContent: 'flex-end', gap: 10 }}>
                <Button variant="ghost" onClick={onClose}>
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
