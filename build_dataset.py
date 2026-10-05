import os
import re
import json
import fitz

BASE_DIR = r"G:\我的雲端硬碟\建築師考試法規\一、歷屆法規考題與分析報告"
OUTPUT_DIR = r"C:\Users\user\.gemini\antigravity\scratch\architect_law_pwa"

EXAMS = [
    {
        "year": 114,
        "q_file": "114年專技高考建築師_建築營建法規與實務_試題.pdf",
        "a_file": "114年專技高考建築師_建築營建法規與實務_更正答案.pdf"
    },
    {
        "year": 113,
        "q_file": "113年專技高考建築師_建築營建法規與實務_試題.pdf",
        "a_file": "113年專技高考建築師_建築營建法規與實務_更正答案.pdf"
    },
    {
        "year": 112,
        "q_file": "112年專技高考建築師_建築營建法規與實務_試題.pdf",
        "a_file": "112年專技高考建築師_建築營建法規與實務_更正答案.pdf"
    },
    {
        "year": 111,
        "q_file": "111年專技高考建築師_建築營建法規與實務_試題.pdf",
        "a_file": "111年專技高考建築師_建築營建法規與實務_更正答案.pdf"
    },
    {
        "year": 110,
        "q_file": "110年專技高考建築師_建築營建法規與實務_試題.pdf",
        "a_file": "110年專技高考建築師_建築營建法規與實務_答案.pdf"
    }
]

# 考點關鍵字規則
CATEGORIES = [
    {
        "id": "C01",
        "name": "防火區劃與貫穿塞封",
        "law": "建築技術規則設計施工編",
        "keywords": ["防火區劃", "貫穿", "防火填塞", "挑空", "防火設備", "防火構造", "區劃面積", "自動滅火", "防火鐵捲門", "排煙", "防火時效"]
    },
    {
        "id": "C02",
        "name": "政府採購法與技服評選",
        "law": "政府採購法及技服辦法",
        "keywords": ["採購法", "招標", "決標", "最有利標", "評選委員會", "停權", "押標金", "履約保證金", "技術服務", "101條", "底價"]
    },
    {
        "id": "C03",
        "name": "建築師法權責與懲戒",
        "law": "建築師法",
        "keywords": ["建築師法", "開業證書", "受聘", "監造人", "親自主持", "懲戒", "建築師公會", "違反法令", "未依圖施工"]
    },
    {
        "id": "C04",
        "name": "無障礙設施設計規範",
        "law": "無障礙設施規範及施工編專章",
        "keywords": ["無障礙", "坡道", "輪椅", "防滑", "昇降機", "無障礙廁所", "無障礙停車", "迴轉半徑", "導盲", "引導標誌", "1:12"]
    },
    {
        "id": "C05",
        "name": "步行距離、特別安全梯與防火門",
        "law": "建築技術規則設計施工編",
        "keywords": ["直通樓梯", "安全梯", "特別安全梯", "排煙室", "步行距離", "防火門", "走廊", "避難層", "屋頂避難平臺", "常閉式", "遮煙性能"]
    },
    {
        "id": "C06",
        "name": "都市計畫、都更危老與容積移轉",
        "law": "都計法、都更條例、危老條例",
        "keywords": ["都市計畫", "都市更新", "危老", "容積移轉", "權利變換", "使用分區", "基準容積", "容積獎勵", "建蔽率", "主要計畫", "細部計畫", "重建計畫"]
    },
    {
        "id": "C07",
        "name": "建築許可、執照變更與使用管理",
        "law": "建築法",
        "keywords": ["建築法", "建造執照", "使用執照", "雜項執照", "拆除執照", "起造人", "設計人", "變更設計", "室內裝修", "違章建築", "公有建築物", "供公眾使用"]
    },
    {
        "id": "C08",
        "name": "營造業專任工程人員與工程品管",
        "law": "營造業法及工程品管要點",
        "keywords": ["營造業法", "專任工程人員", "工地主任", "轉包", "品管人員", "施工品質", "監造報表", "施工日誌", "丙等營造業", "綜合營造業"]
    },
    {
        "id": "C09",
        "name": "國土計畫功能分區與土地管制",
        "law": "國土計畫法及區域計畫法",
        "keywords": ["國土計畫", "功能分區", "國土保育", "農業發展", "城鄉發展", "海洋資源", "非都市土地", "國土復育", "使用許可"]
    },
    {
        "id": "C10",
        "name": "山坡地建築平均坡度與退縮",
        "law": "建築技術規則山坡地專章",
        "keywords": ["山坡地", "平均坡度", "擋土牆", "順向坡", "退縮距離", "基地開發", "土石流"]
    },
    {
        "id": "C11",
        "name": "公寓大廈管理條例",
        "law": "公寓大廈管理條例",
        "keywords": ["公寓大廈", "管理委員會", "區分所有權人", "規約", "專有部分", "共用部分", "公共基金"]
    },
    {
        "id": "C12",
        "name": "綠建築專章與節能減碳",
        "law": "建築技術規則綠建築專章",
        "keywords": ["綠建築", "節約能源", "外殼耗能量", "綠化量", "基地保水", "太陽光電", "雨水貯留", "再生能源"]
    }
]

def classify_question(text):
    for cat in CATEGORIES:
        for kw in cat["keywords"]:
            if kw in text:
                return cat["id"], cat["name"], cat["law"]
    return "C00", "營建法規綜合實務", "相關法規綜合條文"

def extract_answers(pdf_path):
    doc = fitz.open(pdf_path)
    ans_map = {}
    for page in doc:
        tabs = page.find_tables()
        if tabs.tables:
            for tab in tabs.tables:
                extracted = tab.extract()
                for r in range(0, len(extracted), 2):
                    if r + 1 < len(extracted):
                        headers = extracted[r]
                        vals = extracted[r + 1]
                        for h, v in zip(headers, vals):
                            if h and "第" in h and "題" in h:
                                try:
                                    q_num = int(h.replace("第", "").replace("題", ""))
                                    ans_map[q_num] = v.strip().upper()
                                except:
                                    pass
    return ans_map

def parse_exam_pdf(q_pdf_path, year, ans_map):
    doc = fitz.open(q_pdf_path)
    full_text = ""
    for page in doc:
        full_text += page.get_text() + "\n"

    # 清理頁首頁尾
    cleaned_lines = []
    for line in full_text.split("\n"):
        line_s = line.strip()
        if re.search(r"代號：|頁次：|等\s*別：|類\s*科：|科\s*目：|考試時間：|※注意：|禁止使用電子計算器", line_s):
            continue
        if re.search(r"高等考試.*試題|不動產經紀人|記帳士考試", line_s):
            continue
        cleaned_lines.append(line)
    
    content = "\n".join(cleaned_lines)
    
    # 尋找題號分割點
    # 題號通常為獨立行之數字 1 ~ 80
    q_blocks = []
    # 使用正則找出各題號的起點
    q_matches = list(re.finditer(r'(?:^|\n)([1-9][0-9]?)\s*\n', content))
    
    # 過濾出 1~80 的精確序列
    valid_matches = []
    expected = 1
    for m in q_matches:
        num = int(m.group(1))
        if num == expected and num <= 80:
            valid_matches.append(m)
            expected += 1
            
    for i in range(len(valid_matches)):
        start_pos = valid_matches[i].start()
        end_pos = valid_matches[i+1].start() if i + 1 < len(valid_matches) else len(content)
        q_num = int(valid_matches[i].group(1))
        block_text = content[start_pos:end_pos].strip()
        
        # 移除開頭題號
        block_text = re.sub(r'^[0-9]+\s*\n', '', block_text).strip()
        
        # 解析選項
        # 選項符號: \ue18c (A), \ue18d (B), \ue18e (C), \ue18f (D)
        # 部分情況可能為 (A), (B), (C), (D) 或 [A], [B], [C], [D]
        opt_syms = ['\ue18c', '\ue18d', '\ue18e', '\ue18f']
        
        # 尋找選項位置
        opt_positions = []
        for sym in opt_syms:
            pos = block_text.find(sym)
            opt_positions.append(pos)
            
        question_stem = ""
        options = {"A": "", "B": "", "C": "", "D": ""}
        
        if all(p != -1 for p in opt_positions) and opt_positions[0] < opt_positions[1] < opt_positions[2] < opt_positions[3]:
            question_stem = block_text[:opt_positions[0]].strip()
            options["A"] = block_text[opt_positions[0]+1:opt_positions[1]].strip().replace("\n", " ")
            options["B"] = block_text[opt_positions[1]+1:opt_positions[2]].strip().replace("\n", " ")
            options["C"] = block_text[opt_positions[2]+1:opt_positions[3]].strip().replace("\n", " ")
            options["D"] = block_text[opt_positions[3]+1:].strip().replace("\n", " ")
        else:
            # 嘗試文字匹配 (A), (B), (C), (D)
            parts = re.split(r'[\ue18c\ue18d\ue18e\ue18f]', block_text)
            if len(parts) >= 5:
                question_stem = parts[0].strip()
                options["A"] = parts[1].strip().replace("\n", " ")
                options["B"] = parts[2].strip().replace("\n", " ")
                options["C"] = parts[3].strip().replace("\n", " ")
                options["D"] = parts[4].strip().replace("\n", " ")
            else:
                question_stem = block_text
        
        # 清理題幹中的多餘換行
        question_stem = question_stem.replace("\n", " ").strip()
        
        correct_ans = ans_map.get(q_num, "")
        cat_id, cat_name, cat_law = classify_question(question_stem + " " + options["A"] + " " + options["B"] + " " + options["C"] + " " + options["D"])
        
        # 標註是否為政策熱點
        is_hot = False
        if any(w in question_stem for w in ["國土計畫", "危老", "容積移轉", "綠建築", "太陽光電", "品管作業"]):
            is_hot = True
            
        q_blocks.append({
            "id": f"{year}_{q_num:02d}",
            "year": year,
            "q_num": q_num,
            "stem": question_stem,
            "options": options,
            "answer": correct_ans,
            "cat_id": cat_id,
            "cat_name": cat_name,
            "law": cat_law,
            "is_hot": is_hot
        })
        
    return q_blocks

def main():
    all_questions = []
    stats = {}
    
    for item in EXAMS:
        yr = item["year"]
        q_path = os.path.join(BASE_DIR, item["q_file"])
        a_path = os.path.join(BASE_DIR, item["a_file"])
        
        print(f"Parsing {yr} answers...")
        ans_map = extract_answers(a_path)
        print(f"Parsing {yr} questions...")
        questions = parse_exam_pdf(q_path, yr, ans_map)
        print(f"{yr} extracted: {len(questions)} items (expected 80)")
        
        stats[yr] = len(questions)
        all_questions.extend(questions)
        
    out_file = os.path.join(OUTPUT_DIR, "questions.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)
        
    print(f"Total questions generated: {len(all_questions)}")
    print(f"Output saved to: {out_file}")

if __name__ == "__main__":
    main()
