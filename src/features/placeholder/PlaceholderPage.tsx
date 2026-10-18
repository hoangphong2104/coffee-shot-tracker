import { S } from '../../strings.vi'

// TẠM — giữ chỗ cho route chưa làm; xoá khi slice tương ứng xong.
export function PlaceholderPage() {
  return <p className="py-16 text-center text-muted">{S.notYet}</p>
}
