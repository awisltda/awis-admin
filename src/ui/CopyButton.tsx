import { useEffect, useState } from 'react'
import { Button } from './Button'

type Props = {
  value: string
  labelCopy?: string
  labelCopied?: string
}

export function CopyButton({
  value,
  labelCopy = 'Copiar',
  labelCopied = 'Copiado',
}: Props) {
  const [copied, setCopied] = useState(false)

  async function onCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
    }
  }

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={copied ? labelCopied : labelCopy}
      onClick={onCopy}
      className="awis-copy-btn"
      title={copied ? labelCopied : labelCopy}
    >
      {copied ? '✓' : '⧉'}
    </Button>
  )
}
