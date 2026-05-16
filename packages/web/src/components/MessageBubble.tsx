import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { MessageRecord } from '@bed-vibe/shared'

interface Props {
  message: MessageRecord
}

export default function MessageBubble({ message }: Props) {
  const { source, content } = message

  if (source === 'system') {
    return <SystemMessage content={content} />
  }

  if (source === 'user') {
    return <UserMessage content={content} />
  }

  return <AssistantMessage content={content} />
}

function AssistantMessage({ content }: { content: unknown }) {
  const c = content as any
  const blocks: any[] = []

  if (c?.type === 'assistant' && c?.message?.content) {
    blocks.push(...c.message.content)
  } else if (Array.isArray(c)) {
    blocks.push(...c)
  } else {
    blocks.push({ type: 'text', text: JSON.stringify(content) })
  }

  // Filter out empty thinking blocks and other non-renderable blocks
  const renderable = blocks.filter((block) => {
    if (block.type === 'thinking' && !block.text) return false
    if (block.type === 'text' && !block.text) return false
    return true
  })

  if (renderable.length === 0) return null

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] space-y-2">
        {renderable.map((block, i) => {
          if (block.type === 'text' && block.text) {
            return <TextBlock key={i} text={block.text} />
          }
          if (block.type === 'thinking' && block.text) {
            return <ThinkingBlock key={i} text={block.text} />
          }
          if (block.type === 'tool_use') {
            return <ToolUseCard key={i} block={block} />
          }
          if (block.type === 'tool_result') {
            return <ToolResultCard key={i} block={block} />
          }
          return null
        })}
      </div>
    </div>
  )
}

function ThinkingBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="bg-[var(--bg-tertiary)] rounded-[16px] overflow-hidden border border-[var(--border)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span className="text-[11px] text-[var(--text-tertiary)]">{expanded ? '▼' : '▶'}</span>
        <span className="text-xs text-[var(--text-tertiary)]">Thinking</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-xs text-[var(--text-secondary)] whitespace-pre-wrap max-h-60 overflow-y-auto">
          {text.slice(0, 3000)}
        </div>
      )}
    </div>
  )
}

function TextBlock({ text }: { text: string }) {
  return (
    <div className="px-4 py-2.5 bg-[var(--bg-secondary)] rounded-[20px] rounded-bl-[6px] text-sm prose prose-invert prose-sm max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}

function ToolUseCard({ block }: { block: any }) {
  const [expanded, setExpanded] = useState(false)
  const inputStr = typeof block.input === 'string'
    ? block.input
    : JSON.stringify(block.input, null, 2)

  return (
    <div className="bg-[var(--bg-tertiary)] rounded-[16px] overflow-hidden border border-[var(--border)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span className="text-[11px] text-[var(--text-tertiary)]">{expanded ? '▼' : '▶'}</span>
        <span className="text-xs font-mono text-[var(--accent)]">{block.name}</span>
      </button>
      {expanded && (
        <pre className="px-3 pb-3 text-[11px] text-[var(--text-secondary)] overflow-x-auto max-h-60 leading-relaxed">
          {inputStr.slice(0, 3000)}
        </pre>
      )}
    </div>
  )
}

function ToolResultCard({ block }: { block: any }) {
  const [expanded, setExpanded] = useState(false)
  const output = block.content ?? block.output ?? ''
  const text = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
  const isError = block.is_error

  return (
    <div className={`rounded-[16px] overflow-hidden border ${isError ? 'border-red-800 bg-red-950/20' : 'border-[var(--border)] bg-[var(--bg-tertiary)]'}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors"
      >
        <span className="text-[11px] text-[var(--text-tertiary)]">{expanded ? '▼' : '▶'}</span>
        <span className={`text-xs ${isError ? 'text-red-400' : 'text-green-400'}`}>
          {isError ? 'Error' : 'Result'}
        </span>
      </button>
      {expanded && (
        <pre className="px-3 pb-3 text-[11px] text-[var(--text-secondary)] overflow-x-auto max-h-60 leading-relaxed">
          {text.slice(0, 5000)}
        </pre>
      )}
    </div>
  )
}

function SystemMessage({ content }: { content: unknown }) {
  const c = content as any
  if (c?.type === 'system' && c?.subtype === 'turn_duration') return null
  const text = c?.message || c?.subtype || 'system'
  return (
    <div className="flex justify-center py-1">
      <span className="text-[11px] text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-full">
        {text}
      </span>
    </div>
  )
}

function UserMessage({ content }: { content: unknown }) {
  const c = content as any

  // Tool result message (user message containing tool_result blocks)
  if (c?.type === 'user' && Array.isArray(c?.message?.content)) {
    const blocks = c.message.content
    const hasToolResult = blocks.some((b: any) => b.type === 'tool_result')
    if (hasToolResult) {
      return (
        <div className="flex justify-start">
          <div className="max-w-[90%] space-y-2">
            {blocks.map((block: any, i: number) => {
              if (block.type === 'tool_result') {
                return <ToolResultCard key={i} block={block} />
              }
              return null
            })}
          </div>
        </div>
      )
    }
  }

  let text = ''
  if (c?.type === 'user' && c?.message) {
    text = typeof c.message.content === 'string'
      ? c.message.content
      : JSON.stringify(c.message.content)
  } else if (c?.type === 'text' && c?.text) {
    text = c.text
  } else if (typeof c === 'string') {
    text = c
  } else {
    text = JSON.stringify(content)
  }

  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] px-4 py-2.5 bg-[var(--accent)] text-white rounded-[20px] rounded-br-[6px] text-sm whitespace-pre-wrap break-words">
        {text}
      </div>
    </div>
  )
}
