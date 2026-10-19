// ADR_014 — chuỗi giao diện tập trung, lấy NGUYÊN VĂN từ UC / AC đã duyệt (baseline Requirement v2).
// Thêm chuỗi theo từng slice; không tự đặt câu mới ngoài UC.

export const S = {
  appName: 'Shot Tracker',
  tabs: { home: 'Nhà', history: 'Lịch sử', analytics: 'Biểu đồ', gear: 'Đồ nghề', newShot: 'Ghi shot mới' },
  // UC_0901 C 6
  initError: 'Không mở được dữ liệu trên máy này. Kiểm tra trình duyệt cho phép lưu dữ liệu rồi bấm Thử lại',
  retry: 'Thử lại',
  reload: 'Tải lại',
  // ADR_009 / D-4
  newVersion: 'Có bản mới',
  // UC_0001 C 3
  homeEmptyTitle: 'Chưa có shot nào',
  homeEmptySub: 'Bấm ＋ ở giữa thanh dưới để ghi shot đầu tiên',
  homeEmptyCta: 'Ghi shot',
  // NFR_011
  crashTitle: 'Có lỗi khi hiển thị màn này',
  // Tiêu đề header theo SC (screen-flow v1 / prototype v2.1)
  titles: {
    newShot: 'Ghi shot',
    video: 'Quay video',
    gauge: 'Đọc đồng hồ',
    shotDetail: 'Chi tiết shot',
    editShot: 'Sửa shot',
    cup: 'Thưởng thức',
    compare: 'So sánh 2 shot',
    analytics: 'Phân tích',
    newBean: 'Thêm hạt',
    bean: 'Sửa hạt',
    newDevice: 'Thêm thiết bị',
    device: 'Thiết bị',
    editDevice: 'Sửa thiết bị',
  },
  back: 'Quay lại',
  settings: 'Cài đặt',
  // TẠM — chỉ dùng cho màn chưa làm (CODE-002..006); phải hết chỗ dùng trước TEST (implementation-trace DR-03)
  notYet: 'Màn này sẽ có ở bản sau',
} as const
