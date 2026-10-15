// Render plain text only: authored content never becomes executable HTML.
export default function RuleContent({ blocks = [] }) {
  return <div className="space-y-5 text-sm leading-7">
    {blocks.map((block, index) => {
      if (block.type === 'heading') return <h3 key={index} className="border-l-4 border-primary pl-3 text-lg font-semibold tracking-tight text-foreground break-words">{block.text}</h3>;
      if (block.type === 'paragraph') return <p key={index} className="whitespace-pre-wrap break-words text-muted-foreground">{block.text}</p>;
      const List = block.type === 'numbered' ? 'ol' : 'ul';
      return <List key={index} className={`space-y-2 pl-6 text-muted-foreground ${block.type === 'numbered' ? 'list-decimal marker:font-semibold marker:text-primary' : 'list-disc marker:text-primary'}`}>
        {block.text.split(/\r?\n/).filter(item => item.trim()).map((item, i) => <li key={i} className="pl-1 break-words">{item}</li>)}
      </List>;
    })}
  </div>;
}
