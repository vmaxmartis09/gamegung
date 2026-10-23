/** Danh mục đầy đủ nhân vật Ma Sói (cơ bản + mở rộng). Nguồn: thuthuatchoi.com */

export type CatalogTeam = "village" | "wolves" | "solo";
export type CatalogSet = "Cơ bản" | "New Moon" | "The Village" | "Characters" | "Character Plus";

export interface CatalogRole {
  id: string;
  name: string;
  set: CatalogSet;
  team: CatalogTeam;
  emoji: string;
  desc: string;
  /** Tên file trong /images/werewolf_roles/official (không có ảnh → dùng emoji) */
  image?: string;
}

export const SETS: CatalogSet[] = ["Cơ bản", "New Moon", "The Village", "Characters", "Character Plus"];

export const TEAM_META: Record<CatalogTeam, { label: string; color: string; glow: string }> = {
  village: { label: "Phe Dân", color: "#4ade80", glow: "rgba(74,222,128,0.28)" },
  wolves: { label: "Phe Sói", color: "#f87171", glow: "rgba(248,113,113,0.30)" },
  solo: { label: "Phe thứ 3", color: "#c084fc", glow: "rgba(192,132,252,0.30)" },
};

export const catalogImage = (r: CatalogRole) => (r.image ? `/images/werewolf_roles/official/${r.image}` : undefined);

export const WEREWOLF_CATALOG: CatalogRole[] = [
  // ── Cơ bản ──
  { id: "dan-lang", name: "Dân Làng", set: "Cơ bản", team: "village", emoji: "🧑‍🌾", image: "dan-lang.jpg", desc: "Không có năng lực đặc biệt. Dùng suy luận để tìm ra Sói đội lốt người và đem đi treo cổ." },
  { id: "tien-tri", name: "Tiên Tri", set: "Cơ bản", team: "village", emoji: "🔮", image: "tien-tri.jpg", desc: "Mỗi đêm được Quản trò gọi dậy để đoán xem một người có phải Sói hay không." },
  { id: "bao-ve", name: "Bảo Vệ", set: "Cơ bản", team: "village", emoji: "🛡️", image: "bao-ve.jpg", desc: "Mỗi đêm bảo vệ một người (kể cả bản thân), không được bảo vệ cùng một người hai đêm liên tiếp. Vẫn chết nếu bị Phù Thủy đầu độc." },
  { id: "tho-san", name: "Thợ Săn", set: "Cơ bản", team: "village", emoji: "🏹", image: "tho-san.jpg", desc: "Khi bị Sói cắn hoặc bị treo cổ, được kéo theo một người cùng chết." },
  { id: "phu-thuy", name: "Phù Thủy", set: "Cơ bản", team: "village", emoji: "🧪", image: "phu-thuy.jpg", desc: "Có 2 bình thuốc dùng một lần: một bình cứu nạn nhân của Sói, một bình độc để giết người nghi là Sói." },
  { id: "cupid", name: "Cupid", set: "Cơ bản", team: "village", emoji: "💘", image: "cupid.jpg", desc: "Đêm đầu ghép đôi hai người yêu nhau (có thể tự ghép mình). Một người chết thì người kia chết theo; khác phe thì thành phe thứ ba." },
  { id: "truong-lang", name: "Cảnh Sát Trưởng", set: "Cơ bản", team: "village", emoji: "👮", image: "truong-lang.png", desc: "Phiếu bầu được tính là 2 phiếu. Khi chết có quyền chuyển chức cho bất kỳ ai." },
  { id: "co-be", name: "Cô Bé", set: "Cơ bản", team: "village", emoji: "👧", image: "co-be.jpg", desc: "Từ đêm thứ hai được hé mắt nhìn Sói hành động, nhưng nếu bị Sói phát hiện sẽ bị giết ngay." },
  { id: "soi-thuong", name: "Sói Thường", set: "Cơ bản", team: "wolves", emoji: "🐺", image: "soi-thuong.jpg", desc: "Mỗi đêm cùng bầy chọn một dân làng để cắn. Có thể chọn không cắn ai." },
  { id: "soi-con", name: "Sói Con", set: "Cơ bản", team: "wolves", emoji: "🐾", desc: "Giống Sói thường, nhưng khi chết, đêm hôm sau bầy Sói được cắn hai người liên tiếp." },
  { id: "nua-nguoi-nua-soi", name: "Nửa Người Nửa Sói", set: "Cơ bản", team: "solo", emoji: "🧬", image: "nua-nguoi-nua-soi.jpg", desc: "Ban đầu thuộc phe Dân. Nếu bị Sói cắn sẽ không chết mà hoá thành Sói." },
  { id: "soi-trang", name: "Sói Trắng", set: "Cơ bản", team: "solo", emoji: "🤍", image: "soi-trang.jpg", desc: "Thức cùng bầy Sói, nhưng cứ hai đêm được giết một Sói khác. Chỉ thắng khi là người sống sót duy nhất." },
  { id: "an-trom", name: "Ăn Trộm", set: "Cơ bản", team: "village", emoji: "🦹", image: "an-trom.png", desc: "Đêm đầu nhìn hai lá vai phụ và chọn một; nếu có lá Sói thì bắt buộc phải lấy Sói." },
  { id: "cap-doi", name: "Cặp Đôi Khác Phe", set: "Cơ bản", team: "solo", emoji: "💞", desc: "Hai người bị Cupid ghép thuộc hai phe đối lập, cùng thắng khi là hai người cuối cùng còn sống." },

  // ── New Moon ──
  { id: "thang-ngoc", name: "Thằng Ngốc", set: "New Moon", team: "village", emoji: "🤡", image: "thang-ngoc.jpg", desc: "Bị treo cổ thì lật bài và được tha, nhưng mất quyền bỏ phiếu. Vẫn chết nếu bị Sói cắn hoặc Thợ Săn bắn." },
  { id: "gia-lang", name: "Già Làng", set: "New Moon", team: "village", emoji: "🧙‍♂️", image: "gia-lang.jpg", desc: "Sống sót qua 2 lần bị Sói cắn. Bị treo, bắn hay đầu độc thì chết ngay và mọi vai đặc biệt (trừ Thợ Săn) mất năng lực." },
  { id: "nguoi-the-than", name: "Người Thế Thân", set: "New Moon", team: "village", emoji: "🎭", image: "nguoi-the-than.jpg", desc: "Bị loại khi bỏ phiếu hoà. Khi bị loại được chọn những ai có quyền bỏ phiếu sáng hôm sau." },
  { id: "nguoi-thoi-sao", name: "Người Thổi Sáo", set: "New Moon", team: "solo", emoji: "🪈", image: "nguoi-thoi-sao.jpg", desc: "Mỗi đêm thôi miên hai người. Thắng khi toàn bộ người còn sống đều đã bị thôi miên." },

  // ── The Village ──
  { id: "soi-trang-v", name: "Sói Trắng (The Village)", set: "The Village", team: "solo", emoji: "🐺", image: "soi-trang.jpg", desc: "Hành động cùng bầy để lấy lòng tin, sau đó có thể thức riêng để giết một con Sói. Thắng khi sống sót một mình." },
  { id: "ke-dot-nha", name: "Kẻ Đốt Nhà", set: "The Village", team: "solo", emoji: "🔥", image: "ke-dot-nha.jpeg", desc: "Một lần duy nhất đốt một ngôi nhà; chủ nhà thành người vô gia cư. Trúng nạn nhân của Sói thì Sói bên phải chết, nạn nhân sống." },
  { id: "con-qua", name: "Con Quạ", set: "The Village", team: "village", emoji: "🐦‍⬛", image: "con-qua.png", desc: "Cuối mỗi đêm chỉ định một người nghi là Sói; sáng hôm sau người đó tự động nhận 2 phiếu chống." },

  // ── Characters ──
  { id: "dan-thuong", name: "Dân Thường", set: "Characters", team: "village", emoji: "🧑", image: "dan-thuong.png", desc: "Cả hai mặt bài đều là Dân thường nên mọi người biết ngay danh tính ngay từ đầu." },
  { id: "hai-chi-em", name: "Hai Chị Em", set: "Characters", team: "village", emoji: "👭", image: "hai-chi-em.png", desc: "Đêm đầu thức dậy nhận biết nhau để có thể tin tưởng người còn lại." },
  { id: "ba-anh-em", name: "Ba Anh Em", set: "Characters", team: "village", emoji: "👬", image: "ba-anh-em.png", desc: "Giống Hai Chị Em nhưng gồm ba người, cùng nhận biết nhau đêm đầu." },
  { id: "thien-su", name: "Thiên Sứ", set: "Characters", team: "solo", emoji: "😇", image: "thien-su.png", desc: "Thắng ngay nếu bị Sói cắn đêm đầu hoặc bị treo cổ sáng đầu tiên; nếu không sẽ thành Dân thường." },
  { id: "tham-phan", name: "Thẩm Phán Lắp Bắp", set: "Characters", team: "village", emoji: "⚖️", image: "tham-phan.png", desc: "Một lần trong ván được ra dấu hiệu bí mật để tổ chức thêm vòng bỏ phiếu treo cổ thứ hai." },
  { id: "hiep-si", name: "Hiệp Sĩ Kiếm Gỉ", set: "Characters", team: "village", emoji: "⚔️", image: "hiep-si.png", desc: "Bị Sói cắn thì chết, nhưng con Sói đó bị thương và chỉ sống thêm một ngày đêm." },
  { id: "cao", name: "Cáo", set: "Characters", team: "village", emoji: "🦊", image: "cao.png", desc: "Mỗi đêm chọn 3 người; có ít nhất một Sói thì giữ năng lực, nếu không sẽ mất." },
  { id: "nguoi-thuan-phuc-gau", name: "Người Thuần Phục Gấu", set: "Characters", team: "village", emoji: "🐻", image: "nguoi-thuan-phuc-gau.png", desc: "Được Quản trò ra dấu nếu một trong hai người ngồi cạnh là Sói." },
  { id: "dien-vien", name: "Diễn Viên", set: "Characters", team: "village", emoji: "🎪", image: "dien-vien.png", desc: "Ba đêm đầu được đổi bài với một trong 3 lá vai phụ. Sau đêm thứ ba trở về Dân thường." },
  { id: "nguoi-day-to", name: "Người Đầy Tớ Tận Tụy", set: "Characters", team: "solo", emoji: "🎩", image: "nguoi-day-to.jpg", desc: "Bất cứ lúc nào có thể đổi bài với nạn nhân bị làng bỏ phiếu và đóng vai đó đến hết ván." },
  { id: "giao-phai", name: "Thành Viên Giáo Phái", set: "Characters", team: "solo", emoji: "🕍", image: "giao-phai.jpg", desc: "Làng được chia hai phe; hắn thắng khi loại bỏ toàn bộ phe đối địch." },
  { id: "tre-hoang-da", name: "Đứa Trẻ Hoang Dã", set: "Characters", team: "village", emoji: "🧒", image: "tre-hoang-da.png", desc: "Đầu ván chọn một hình mẫu; nếu hình mẫu chết, đứa trẻ hoá thành Sói." },
  { id: "soi-lai", name: "Chó Sói / Sói Lai", set: "Characters", team: "solo", emoji: "🐕", image: "soi-lai.jpg", desc: "Đầu ván tự chọn làm Dân làng hay làm Sói." },
  { id: "soi-lon", name: "Sói Lớn Xấu Xa", set: "Characters", team: "wolves", emoji: "🐺", image: "soi-lon.png", desc: "Khi Sói con, Đứa trẻ hoang dã hay Nửa người nửa sói đã chết, được thức thêm một lần để ăn thêm một dân làng." },
  { id: "cha-cua-soi", name: "Người Cha Của Sói", set: "Characters", team: "wolves", emoji: "🍼", image: "cha-cua-soi.jpg", desc: "Một lần duy nhất biến nạn nhân của bầy Sói thành Sói." },
  { id: "ba-dong", name: "Bà Đồng", set: "Characters", team: "village", emoji: "🕯️", image: "ba-dong.jpg", desc: "Năm lần dùng thẻ Thông linh để hỏi người chết đầu tiên một câu hỏi Có/Không." },
  { id: "canh-sat", name: "Cảnh Sát", set: "Characters", team: "village", emoji: "🚓", desc: "Do Cảnh sát trưởng chỉ định; mỗi sáng bốc thẻ sự kiện và công bố. Có thể bị cách chức trước giờ bỏ phiếu." },

  // ── Character Plus ──
  { id: "nguyet-nu", name: "Nguyệt Nữ", set: "Character Plus", team: "village", emoji: "🌙", image: "nguyet-nu.png", desc: "Mỗi đêm vô hiệu hoá năng lực của một người (trừ Bảo Vệ và năng lực ban ngày)." },
  { id: "thay-thoi-mien", name: "Thầy Thôi Miên", set: "Character Plus", team: "village", emoji: "🌀", image: "thay-thoi-mien.png", desc: "Mê hoặc một người mỗi đêm; nếu thầy chết, người bị mê hoặc chết thay. Không chọn cùng một người hai đêm liền." },
  { id: "duoc-si", name: "Dược Sĩ", set: "Character Plus", team: "village", emoji: "💊", image: "duoc-si.png", desc: "Hai bình thuốc dùng một lần: thuốc mê khiến một người câm cả ngày, thuốc hồi phục cứu nạn nhân của Phù Thủy." },
  { id: "nguoi-mua-roi", name: "Người Múa Rối", set: "Character Plus", team: "wolves", emoji: "🎎", image: "nguoi-mua-roi.png", desc: "Một lần duy nhất điều khiển bầy Sói ăn thịt một người chỉ định, kể cả một con Sói." },
  { id: "sat-thu", name: "Sát Thủ", set: "Character Plus", team: "solo", emoji: "🗡️", image: "sat-thu.png", desc: "Cứ hai đêm, nếu có đủ 4 phiếu chỉ vào hắn thì được giết một người." },
  { id: "ki-si", name: "Kị Sĩ", set: "Character Plus", team: "village", emoji: "🏇", image: "ki-si.png", desc: "Một lần ban ngày trước giờ treo cổ chọn một người: là Sói thì Sói chết và kết thúc ngày, không thì Kị Sĩ chết." },
  { id: "con-qua-plus", name: "Con Quạ (Plus)", set: "Character Plus", team: "village", emoji: "🐦‍⬛", image: "con-qua-plus.png", desc: "Mỗi đêm nguyền rủa một người; sáng hôm sau người đó tự động có 2 phiếu treo cổ." },
  { id: "nguoi-goi-hon", name: "Người Gọi Hồn", set: "Character Plus", team: "village", emoji: "🔮", image: "nguoi-goi-hon.png", desc: "Mỗi đêm hỏi người chết gần nhất xem họ nghi ai; người chết chỉ tay không lời." },
  { id: "soi-lua", name: "Sói Lửa", set: "Character Plus", team: "wolves", emoji: "🔥", image: "soi-lua.png", desc: "Sau khi một Sói chết được xoá vĩnh viễn năng lực của một người; sau hai Sói chết được làm lần thứ hai." },
  { id: "anh-em-soi", name: "Anh Em Sói", set: "Character Plus", team: "wolves", emoji: "🐺", image: "anh-em-soi.png", desc: "Sói Anh hoạt động; Sói Em ẩn mình cho đến khi anh chết, rồi giết một người và gia nhập bầy." },
  { id: "anh-tu", name: "Ảnh Tử", set: "Character Plus", team: "solo", emoji: "👤", image: "anh-tu.png", desc: "Đêm đầu chọn một người: nếu người đó còn sống đến cuối thì thắng cùng Dân; nếu chết thì lấy vai của họ." },
  { id: "ke-bao-thu", name: "Kẻ Báo Thù", set: "Character Plus", team: "solo", emoji: "⚰️", image: "ke-bao-thu.png", desc: "Đêm đầu chọn làm Sói hay Dân. Khi chết chọn một người; nếu thuộc phe đối lập thì chết ngay." },
];
