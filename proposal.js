// グローバル変数
let casesData = '';
let currentProposal = '';

// ページロード時の処理
document.addEventListener('DOMContentLoaded', () => {
    loadCasesData();
    setupEventListeners();
});

// 事例データ（cases_analyzed.md）を読み込む
async function loadCasesData() {
    try {
        const response = await fetch('cases_analyzed.md');
        casesData = await response.text();
        console.log('事例データを読み込みました');
    } catch (error) {
        console.error('事例データの読み込みに失敗しました:', error);
        showError('事例データの読み込みに失敗しました。ページをリロードしてください。');
    }
}

// イベントリスナーの設定
function setupEventListeners() {
    document.getElementById('proposalForm').addEventListener('submit', (e) => {
        e.preventDefault();
        generateProposal();
    });
}

// 提案を生成（Claude APIを使用）
async function generateProposal() {
    // 入力値を取得
    const apiKey = document.getElementById('apiKey').value;
    const subject = document.getElementById('subject').value;
    const grade = document.getElementById('grade').value;
    const objective = document.getElementById('objective').value;
    const additionalInfo = document.getElementById('additionalInfo').value;

    // バリデーション
    if (!apiKey) {
        showError('Claude APIキーを入力してください');
        return;
    }
    if (!subject || !grade || !objective) {
        showError('教科・学年・やりたいことは必須項目です');
        return;
    }

    // エラーメッセージをクリア
    document.getElementById('errorMessage').style.display = 'none';

    // ローディング表示
    document.getElementById('resultSection').style.display = 'block';
    document.getElementById('resultContent').innerHTML = '<p>📝 提案を生成中...</p>';
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });

    try {
        // Claude APIを呼び出し
        const proposal = await callClaudeAPI(apiKey, subject, grade, objective, additionalInfo);

        // 結果を表示
        displayProposal(proposal);
    } catch (error) {
        console.error('API呼び出しに失敗しました:', error);
        showError(`エラーが発生しました: ${error.message}`);
        document.getElementById('resultSection').style.display = 'none';
    }
}

// Claude APIを呼び出す
async function callClaudeAPI(apiKey, subject, grade, objective, additionalInfo) {
    const prompt = `あなたは体験的な学習活動の設計専門家です。

以下の事例集から学んだ「体験的学習活動の設計パターン」を参考にして、この学習目標に対応する新しい学習活動を提案してください。

【事例集】
${casesData}

【学習目標】
教科：${subject}
学年：${grade}
目標：${objective}
${additionalInfo ? `その他の条件：${additionalInfo}` : ''}

【提案の構成】

## 概要
- **活動カテゴリ**：（ゲーム、シミュレーション、ロールプレイ・演劇、探究・問題解決、ものづくり・デザイン等から最適なものを選択）
- **根拠**：（既存事例のどのパターンを応用したか、なぜこの活動が学習目標に有効か）

## ワーク構成

このセクションで、教室で実際に実行される具体的なワークを記述してください。
AI講座ビルダーの以下の形式に従ってください：

ワーク1: 【ワーク名】（【時間】分・【形式】）
  ステップ: 【具体的なステップ1】 → 【具体的なステップ2】 → 【具体的なステップ3】 → 【具体的なステップ4】

ワーク2: 【ワーク名】（【時間】分・【形式】）
  ステップ: 【具体的なステップ1】 → 【具体的なステップ2】 → 【具体的なステップ3】

※重要：各ステップは「生徒は何をするのか」を明確に。例えば「カードを並べる」「シートに記入する」「議論する」など、動詞で始まる具体的な動作。

## 設計の11観点

各観点について簡潔に説明：
- **活動の形**（個人 / ペア / グループ / 全体）
- **身体性**（着席 / 立つ・移動 / その他）
- **使うもの**（物理材料 / デジタル / 資料 / その他）
- **問いの性質**（正解あり / 複数解 / 正解なし）
- **他者との関係**（協力 / 競争 / 議論 / 役割分担）
- **産出物**（具体的な成果物の種類）
- **現実との接点**（実社会 / 模擬 / 架空）
- **時間軸**（単発 / 複数時間 / 長期）
- **評価の対象**（何を評価するか）
- **評価の方法**（どう評価するか）
- **評価のタイミング**（いつ評価するか）

【重要な指示】
- 既存の事例をそのまま推奨しないこと
- ワーク構成は「教師が指示でき、生徒が実行できる」レベルの具体性を必須とすること
- 発達段階（${grade}生）に適切な複雑さと工夫を含めること
- 各ワークの時間配分は現実的であること（合計が授業時間内に収まること）`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 2000,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'API呼び出しに失敗しました');
    }

    const data = await response.json();
    return data.content[0].text;
}

// 提案を表示
function displayProposal(proposal) {
    currentProposal = proposal;
    // テキストをHTMLエスケープしつつ、改行と見出しの基本的なフォーマットを適用
    const formattedProposal = proposal
        .split('\n')
        .map(line => {
            if (line.startsWith('##')) {
                return `<h3>${line.replace(/^##\s*/, '')}</h3>`;
            } else if (line.startsWith('**') && line.endsWith('**')) {
                return `<strong>${line.replace(/\*\*/g, '')}</strong>`;
            } else if (line.trim() === '') {
                return '<br>';
            } else {
                return `<p>${line}</p>`;
            }
        })
        .join('');

    document.getElementById('resultContent').innerHTML = formattedProposal;
    document.getElementById('resultSection').style.display = 'block';

    // スクロール
    document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth' });
}

// 提案をコピー
function copyProposal() {
    const text = document.getElementById('resultContent').innerText;
    navigator.clipboard.writeText(text).then(() => {
        alert('提案をコピーしました。テキストエディタに貼り付けてください。');
    }).catch(err => {
        console.error('コピーに失敗しました:', err);
        alert('コピーに失敗しました。手動でコピーしてください。');
    });
}

// フォームをリセット
function resetForm() {
    document.getElementById('proposalForm').reset();
    document.getElementById('resultSection').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// エラーメッセージを表示
function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}
