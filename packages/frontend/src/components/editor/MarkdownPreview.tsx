import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownPreview({ content }: { content: string }) {
  return (
    <article className="markdown-preview rounded-2xl border border-border bg-surface p-5 text-text">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </article>
  )
}
