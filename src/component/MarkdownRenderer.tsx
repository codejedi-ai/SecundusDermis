import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface MarkdownRendererProps {
    markdown: string
}

const MarkdownRenderer = ({ markdown }: MarkdownRendererProps) => {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
        >
            {markdown}
        </ReactMarkdown>
    )
}

export default MarkdownRenderer