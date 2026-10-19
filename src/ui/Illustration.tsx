import type { Device } from '../data/types'
import { BAG, BY_DEVICE, BY_KIND, ILLU } from './illustrations.generated'

// Hình nét vẽ minh hoạ theo dáng dòng máy (không phải ảnh thật — UC_0302 bước 5). Nét = currentColor nên theo theme.

export const illuKey = (d: Pick<Device, 'id' | 'kind' | 'illustration'>) => d.illustration || BY_DEVICE[d.id] || BY_KIND[d.kind] || 'b-flat'

export function Illustration({ name, label, className = 'illu' }: { name: string; label: string; className?: string }) {
  const draw = ILLU[name] ?? ILLU['b-flat']
  return (
    <svg className={className} viewBox="0 0 120 120" role="img" aria-label={label} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {draw()}
    </svg>
  )
}

export function BeanBag({ roast, label }: { roast?: string | null; label: string }) {
  const draw = BAG[(roast === 'Light' || roast === 'Medium' || roast === 'Dark' ? roast : 'none') as keyof typeof BAG]
  return (
    <svg className="illu" viewBox="0 0 120 120" role="img" aria-label={label} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {draw()}
    </svg>
  )
}

export const Burr = ({ type }: { type?: string | null }) => <Illustration name={type === 'Côn' ? 'burr-conical' : 'burr-flat'} label={`Hình cối ${type ?? ''}`.trim()} />
