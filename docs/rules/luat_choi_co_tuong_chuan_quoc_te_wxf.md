# LUẬT CHƠI CỜ TƯỚNG CHUẨN QUỐC TẾ (WXF)

Tài liệu này tổng hợp toàn diện các quy chuẩn thi đấu của **Liên đoàn Cờ tướng Thế giới (World Xiangqi Federation - WXF)**, bao gồm cấu trúc bàn cờ, cách di chuyển của các quân, các quy tắc đặc biệt, xử lý hòa cờ và luật cấm lặp nước.

---

## 1. Bàn cờ và Bố trí Quân cờ

### 1.1. Cấu trúc bàn cờ
* **Đặc điểm:** Bàn cờ gồm 9 đường dọc và 10 đường ngang cắt nhau vuông góc, tạo thành **90 giao điểm**. Các quân cờ di chuyển và đứng tại các giao điểm (không đứng trong ô vuông).
* **Sông (Hà):** Khoảng trống ngăn cách ở giữa bàn cờ, chia bàn cờ làm hai nửa đối xứng (nửa trên và nửa dưới).
* **Cung Tướng (Cửu Cung):** Vùng có kích thước $3 \times 3$ điểm (tổng cộng 9 giao điểm) nằm ở trung tâm cạnh đáy của mỗi bên, có hai đường chéo nối các góc đối diện tạo thành hình chữ "X".

### 1.2. Quân cờ và vị trí xuất phát
Mỗi bên sở hữu **16 quân cờ**. Bên Đỏ luôn là bên được quyền đi trước, bên Đen (hoặc Xanh) đi sau.

* **Tướng (King):** 1 quân
  * Đỏ: Súy (帥) | Đen: Tướng (將)
  * Vị trí khởi đầu: Giao điểm chính giữa hàng 1 (hàng đáy).
* **Sĩ (Advisor):** 2 quân
  * Đỏ: Sĩ (仕) | Đen: Sĩ (士)
  * Vị trí: Đứng hai bên cạnh Tướng.
* **Tượng (Bishop / Elephant):** 2 quân
  * Đỏ: Tượng (相) | Đen: Tượng (象)
  * Vị trí: Đứng cạnh hai quân Sĩ.
* **Mã (Knight / Horse):** 2 quân
  * Ký hiệu: Mã (馬)
  * Vị trí: Đứng cạnh hai quân Tượng.
* **Xe (Rook / Chariot):** 2 quân
  * Ký hiệu: Xe (車)
  * Vị trí: Đứng ở hai góc bàn cờ (hàng đáy).
* **Pháo (Cannon):** 2 quân
  * Đỏ: Pháo (炮) | Đen: Pháo (砲)
  * Vị trí: Đặt ở hàng thứ 3 tính từ đáy, nằm trên cột thứ 2 và thứ 8.
* **Tốt / Binh (Pawn / Soldier):** 5 quân
  * Đỏ: Binh (兵) | Đen: Tốt (卒)
  * Vị trí: Đặt ở hàng thứ 4 tính từ đáy, cách nhau một cột (cột 1, 3, 5, 7, 9).

---

## 2. Quy tắc di chuyển và bắt quân

Nguyên tắc chung: Khi một quân cờ đi tới một giao điểm đang có quân đối phương chiếm giữ, quân đối phương bị bắt và đưa ra khỏi bàn cờ.

| Quân cờ | Quy tắc di chuyển | Quy tắc bắt quân | Giới hạn & Điểm cản |
| :--- | :--- | :--- | :--- |
| **Tướng** | Đi từng ô một theo chiều ngang hoặc dọc. | Giống cách đi. | Chỉ được di chuyển trong phạm vi **Cửu Cung**. **Quy tắc lộ mặt Tướng:** Hai Tướng không bao giờ được nhìn thẳng mặt nhau trên cùng một cột dọc mà không có bất kỳ quân nào chắn giữa. |
| **Sĩ** | Đi chéo 1 ô mỗi nước. | Giống cách đi. | Chỉ được di chuyển theo các đường chéo trong phạm vi **Cửu Cung**. |
| **Tượng** | Đi chéo 2 ô (tạo thành hình vuông $2 \times 2$ ô). | Giống cách đi. | **Không được qua sông**. Bị **cản Tượng (chẹn mắt Tượng)**: Nếu có một quân nằm ngay giao điểm tâm của hình vuông đường chéo, Tượng không thể nhảy qua điểm đó. |
| **Xe** | Đi ngang hoặc dọc không giới hạn khoảng cách trên đường trống. | Giống cách đi. | Không được nhảy qua đầu bất kỳ quân nào. |
| **Pháo** | Đi ngang hoặc dọc tự do như Xe khi không ăn quân. | **Cần một quân làm ngòi:** Pháo bắt buộc phải nhảy qua đúng một quân cờ (bất kể phe mình hay phe đối thủ) để ăn quân đối phương phía sau. | Không thể nhảy qua quân cờ khi di chuyển thông thường (chỉ nhảy khi ăn quân). |
| **Mã** | Đi theo hình chữ "L" (đi thẳng 1 ô rồi rẽ chéo 1 ô). | Ăn quân tại vị trí đáp cuối cùng. | Bị **cản Mã (chẹn chân Mã)**: Nếu có một quân đứng ngay tại điểm tiếp giáp theo hướng thẳng mà Mã định bước tới, đường đi của Mã bị chặn hoàn toàn theo hướng đó. |
| **Tốt / Binh** | **Chưa qua sông:** Chỉ được tiến thẳng từng ô một. <br>**Đã qua sông:** Có thể tiến thẳng hoặc đi ngang sang trái/phải 1 ô. | Giống cách đi. | **Không bao giờ được đi lùi.** Tốt khi đã tiến xuống hàng đáy của đối phương chỉ còn có thể di chuyển ngang. |

---

## 3. Chiếu, Chiếu bí và Kết thúc ván cờ

### 3.1. Chiếu Tướng (Check)
* Nước đi đe dọa trực tiếp bắt Tướng đối phương ở lượt tiếp theo.
* Đấu thủ bị chiếu bắt buộc phải hóa giải nước chiếu ngay lập tức bằng một trong các phương án:
  1. Di chuyển Tướng sang vị trí an toàn.
  2. Dùng quân khác che chắn đường chiếu.
  3. Bắt quân cờ đang thực hiện nước chiếu.

### 3.2. Phân định Thắng - Thua
1. **Chiếu bí (Sát cuộc):** Bên bị chiếu không còn bất kỳ nước đi hợp lệ nào để giải cứu Tướng. Bên chiếu giành chiến thắng.
2. **Khốn quân (Bí nước):** Đến lượt đi, người chơi không bị chiếu nhưng **không còn bất kỳ nước đi hợp lệ nào**. Người bị khốn quân **bị xử THUA** (khác biệt quan trọng so với cờ vua).
3. **Đầu hàng:** Đấu thủ chủ động xin thua.
4. **Hết thời gian:** Hết thời gian thi đấu quy định theo đồng hồ bấm giờ.
5. **Vi phạm quy tắc cấm lặp nước:** Tái phạm các lỗi chiếu lặp hoặc đuổi bắt quân lặp lại mà không chịu đổi nước.

### 3.3. Các trường hợp Hòa cờ
1. **Thỏa thuận hòa:** Hai đấu thủ đồng ý chia điểm trong lượt đi của mình.
2. **Không đủ lực lượng tấn công:** Hai bên không còn đủ quân để tạo ra thế chiếu bí (ví dụ: Tướng đơn độc đối đầu Tướng đơn độc; Tướng + Sĩ/Tượng đấu Tướng).
3. **Quy tắc giới hạn số nước đi:** Trải qua số nước đi liên tiếp quy định (thường là 60 nước theo luật thi đấu quốc tế) mà không có quân nào bị bắt.

---

## 4. Luật Chiếu lặp & Đuổi lặp (Trọng tài WXF)

Khác với quy tắc "lặp lại 3 lần thành hòa" của cờ vua, cờ tướng quốc tế phân biệt nghiêm ngặt giữa nước đi **Hợp pháp (Trực)** và **Bị cấm (Trắc)** nhằm ngăn chặn các hành vi cố tình kéo dài ván đấu không công bằng:

1. **Trường chiếu (Chiếu liên tục vĩnh viễn):** Dùng một hoặc nhiều quân liên tiếp chiếu Tướng tạo thành chu kỳ lặp lại.
   * **Xử lý:** Bên liên tục chiếu **bắt buộc phải đổi nước đi**. Nếu cố tình tiếp tục thực hiện sau khi trọng tài nhắc nhở, bên chiếu sẽ bị **xử THUA**.
2. **Trường tróc (Đuổi bắt quân liên tục):** Dùng quân chủ lực liên tục đuổi bắt một quân của đối phương (trừ trường hợp dùng Tướng hoặc Tốt truy đuổi).
   * **Xử lý:** Bên chủ động truy đuổi phải đổi nước đi; không đổi sẽ bị **xử THUA**.
3. **Một bên chiếu / một bên đỡ:** Bên chiếu phải đổi nước.
4. **Hai bên cùng đe dọa (Lưỡng tróc / Đôi bên cùng đổi quân):** Hai bên cùng lặp lại các thế cờ có tính chất cân bằng, ván đấu được công nhận kết quả **HÒA**.

---

## 5. Quy chuẩn đạo đức và tác phong thi đấu

1. **Chạm quân nào phải đi quân đó:** Khi đã chủ ý chạm vào một quân cờ của mình có nước đi hợp lệ, bắt buộc phải đi quân đó; nếu chạm vào quân đối phương có thể bắt được thì bắt buộc phải bắt.
2. **Chỉnh quân:** Nếu muốn sửa lại vị trí quân cờ cho ngay ngắn tại giao điểm, người chơi phải tuyên bố trước với đối thủ: *"Tôi chỉnh quân"* (Adjust).
3. **Thao tác một tay:** Người chơi phải dùng cùng một tay để thực hiện nước đi, bắt quân và bấm đồng hồ thi đấu.