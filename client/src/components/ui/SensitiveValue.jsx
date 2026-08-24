import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function SensitiveValue({
  value,
  formatter = (item) => item,
  className = '',
  mask = 'PKR ••••••',
  visible: controlledVisible,
  defaultVisible = false,
  showToggle = true,
  onVisibleChange,
}) {
  const [uncontrolledVisible, setUncontrolledVisible] = useState(defaultVisible);
  const visible = controlledVisible ?? uncontrolledVisible;

  function toggleVisibility(event) {
    event?.stopPropagation?.();
    const nextValue = !visible;
    if (typeof onVisibleChange === 'function') {
      onVisibleChange(nextValue);
      return;
    }
    setUncontrolledVisible(nextValue);
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{visible ? formatter(value) : mask}</span>
      {showToggle && (
        <button
          type="button"
          onClick={toggleVisibility}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={visible ? 'Hide salary' : 'Show salary'}
          title={visible ? 'Hide salary' : 'Show salary'}
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
    </span>
  );
}
