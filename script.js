// グローバル変数
let exploreCases = [];
let trainingCases = [];
let currentMode = 'explore';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const modal = document.getElementById('modal');
const resultsContainer = document.getElementById('results');
const resultsTitle = document.getElementById('resultsTitle');

// レベル表示名マッピング
const LEVEL_LABELS = {
    '入門': '入門（初めて学ぶ）',
    '基礎': '基礎（概念を理解している）',
    '応用': '応用（基礎を活用できる）',
    '発展': '発展（深く探究できる）'
};

// ページロード時
document.addEventListener('DOMContentLoaded', () => {
    loadAllCases();
    setupModeSwitch();
    setupSearchForms();
    setupModal();
    setupApiKey();
    document.getElementById('generateBtn').addEventListener('click', generateActivity);
});

// 全データを読み込む
async function loadAllCases() {
    try {
        const [exploreRes, trainingRes] = await Promise.all([
            fetch('data/cases.json'),
            fetch('data/cases_training.json')
        ]);
        exploreCases = await exploreRes.json();
        trainingCases = await trainingRes.json();
    } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
    }
}

// ── APIキー管理 ──────────────────────────────────────────

function setupApiKey() {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) {
        showApiKeySet();
    } else {
        showApiKeyInput();
    }

    document.getElementById('saveApiKey').addEventListener('click', () => {
        const key = document.getElementById('apiKeyInput').value.trim();
        if (!key) { alert('APIキーを入力してください。'); return; }
        localStorage.setItem('gemini_api_key', key);
        showApiKeySet();
    });

    document.getElementById('clearApiKey').addEventListener('click', () => {
        localStorage.removeItem('gemini_api_key');
        document.getElementById('apiKeyInput').value = '';
        showApiKeyInput();
    });
}

function showApiKeyInput() {
    document.getElementById('apiKeySection').classList.remove('hidden');
    document.getElementById('apiKeySet').classList.add('hidden');
}

function showApiKeySet() {
    document.getElementById('apiKeySection').classList.add('hidden');
    document.getElementById('apiKeySet').classList.remove('hidden');
}

function getApiKey() {
    return localStorage.getItem('gemini_api_key');
}

// ── モード切替 ───────────────────────────────────────────

function setupModeSwitch() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });
}

function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    document.getElementById('formExplore').classList.toggle('hidden', mode !== 'explore');
    document.getElementById('formTraining').classList.toggle('hidden', mode !== 'training');
    resultsTitle.textContent = '検索結果';
    resultsContainer.innerHTML = '<p class="no-results">検索条件を入力して操作してください。</p>';
}

// ── 検索フォーム ─────────────────────────────────────────

function setupSearchForms() {
    document.getElementById('searchFormExplore').addEventListener('submit', (e) => {
        e.preventDefault();
        searchExplore();
    });
    document.getElementById('searchFormTraining').addEventListener('submit', (e) => {
        e.preventDefault();
    });
}

function searchExplore() {
    const subject = document.getElementById('subject').value;
    const grade = document.getElementById('grade').value;
    const activityForms = Array.from(
        document.querySelectorAll('#formExplore input[name="activityForm"]:checked')
    ).map(el => el.value);

    let filtered = exploreCases.filter(c => {
        if (subject && !c.subject.includes(subject)) return false;
        if (grade && !c.grade.includes(grade)) return false;
        if (activityForms.length > 0) {
            const match = activityForms.some(f =>
                c.activityForm.some(cf => cf.includes(f) || f.includes(cf))
            );
            if (!match) return false;
        }
        return true;
    });

    const conditions = [];
    if (subject) conditions.push(`教科: ${subject}`);
    if (grade) conditions.push(`学年: ${grade}`);
    if (activityForms.length > 0) conditions.push(`活動の形: ${activityForms.join(', ')}`);

    displayResults(filtered, conditions, 'explore');
}

function searchTraining() {
    const level = document.getElementById('level').value;
    const activityType = document.getElementById('activityType').value;
    const duration = document.getElementById('duration').value;

    let filtered = trainingCases.filter(c => {
        if (level && c.level !== level) return false;
        if (activityType && c.activityType !== activityType) return false;
        if (duration && c.duration !== duration) return false;
        return true;
    });

    const conditions = [];
    if (level) conditions.push(`レベル: ${LEVEL_LABELS[level] || level}`);
    if (activityType) conditions.push(`タイプ: ${activityType}`);
    if (duration) conditions.push(`時間: ${duration}`);

    displayResults(filtered, conditions, 'training');
}

// ── Gemini API 生成 ──────────────────────────────────────

async function generateActivity() {
    const apiKey = getApiKey();
    if (!apiKey) {
        alert('APIキーを設定してください。');
        return;
    }

    const theme = document.getElementById('lessonTheme').value.trim();
    if (!theme) {
        alert('授業テーマ・単元を入力してください。');
        return;
    }

    const goal = document.getElementById('learningGoal').value.trim();
    if (!goal) {
        alert('学習目標を入力してください。');
        return;
    }

    const trainingGrade = document.getElementById('trainingGrade').value;
    const trainingSubject = document.getElementById('trainingSubject').value;
    const level = document.getElementById('level').value;
    const activityType = document.getElementById('activityType').value;
    const duration = document.getElementById('duration').value;

    const gradeLabel = trainingGrade || '指定なし';
    const subjectLabel = trainingSubject || '指定なし';
    const levelLabel = level ? LEVEL_LABELS[level] : '指定なし';
    const activityLabel = activityType || '指定なし';
    const durationLabel = duration || '指定なし';

    // ローディング表示
    resultsTitle.textContent = 'AIが活動を生成中...';
    resultsContainer.innerHTML = '<div class="loading"><div class="spinner"></div><p>Geminiが授業活動を設計しています...</p></div>';

    const prompt = `以下の条件で、10〜30分で完結する対面授業の活動を1つ設計してください。

学年: ${gradeLabel}
教科・領域: ${subjectLabel}
授業テーマ・単元: ${theme}
学習目標: ${goal}
学習者レベル: ${levelLabel}
所要時間: ${durationLabel}
活動タイプ: ${activityLabel || '条件に最も適したものを選ぶ'}

以下のJSON形式で回答してください：
{
  "活動名": "テーマを含む具体的な活動名",
  "活動タイプ": "ハンズオン / ケーススタディ / ロールプレイ / グループワーク / 振り返り",
  "概要": "学習者が何をして、どのように学習目標を達成するかを2文で記述",
  "手順": ["ステップ1（〇分）：内容", "ステップ2（〇分）：内容", "ステップ3（〇分）：内容"],
  "準備物": "必要な教材・道具",
  "ポイント": "ファシリテーターが特に意識すべき1点",
  "確認方法": "活動後に学習目標の達成を確認する方法"
}`;

    try {
        const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' }
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('レスポンスが空です');

        const activity = JSON.parse(text);
        displayGenerated(activity, theme, goal, levelLabel, durationLabel);

    } catch (err) {
        console.error(err);
        resultsTitle.textContent = '生成エラー';
        resultsContainer.innerHTML = `<p class="no-results error">生成に失敗しました：${err.message}</p>`;
    }
}

// ── 生成結果の表示 ───────────────────────────────────────

function displayGenerated(activity, theme, goal, level, duration) {
    resultsTitle.textContent = `AI生成結果：${theme}`;

    const stepsHTML = Array.isArray(activity['手順'])
        ? `<ol class="steps">${activity['手順'].map(s => `<li>${s}</li>`).join('')}</ol>`
        : `<p>${activity['手順']}</p>`;

    resultsContainer.innerHTML = `
        <div class="generated-card">
            <div class="generated-header">
                <span class="ai-badge">AI生成</span>
                <span class="category-badge training-badge">${activity['活動タイプ'] || ''}</span>
            </div>
            <h3>${activity['活動名']}</h3>
            <p class="summary">${activity['概要']}</p>
            <div class="generated-body">
                <div class="gen-section">
                    <div class="gen-label">手順</div>
                    ${stepsHTML}
                </div>
                <div class="gen-section">
                    <div class="gen-label">準備物</div>
                    <p>${activity['準備物']}</p>
                </div>
                <div class="gen-section">
                    <div class="gen-label">ポイント</div>
                    <p>${activity['ポイント']}</p>
                </div>
                <div class="gen-section">
                    <div class="gen-label">確認方法</div>
                    <p>${activity['確認方法']}</p>
                </div>
            </div>
            <button class="adopt-button" onclick="adoptGenerated(${JSON.stringify(activity).replace(/"/g, '&quot;')}, '${theme}', '${goal.replace(/'/g, "\\'")}')">
                この活動を採用（コピー）
            </button>
        </div>
    `;
}

// ── 検索結果の表示 ───────────────────────────────────────

function displayResults(results, conditions, mode) {
    const conditionText = conditions.length > 0 ? `（${conditions.join(' / ')}）` : '';
    resultsTitle.textContent = `参考事例: ${results.length}件 ${conditionText}`;

    if (results.length === 0) {
        resultsContainer.innerHTML = '<p class="no-results">条件に合う事例がありません。</p>';
        return;
    }

    resultsContainer.innerHTML = results.map(c => {
        if (mode === 'training') {
            return `
                <div class="case-card training-card" onclick="showDetail('${c.id}', 'training')">
                    <h3>${c.name}</h3>
                    <span class="category-badge training-badge">${c.category}</span>
                    <p class="summary">${c.summary}</p>
                    <div class="info">
                        <div class="info-item">
                            <div class="info-label">レベル</div>
                            ${LEVEL_LABELS[c.level] || c.level}
                        </div>
                        <div class="info-item">
                            <div class="info-label">所要時間</div>
                            ${c.duration}
                        </div>
                        <div class="info-item">
                            <div class="info-label">現場適用性</div>
                            ${c.fieldApplicability}
                        </div>
                        <div class="info-item">
                            <div class="info-label">ファシリ負荷</div>
                            ${c.facilitatorLoad}
                        </div>
                    </div>
                    <span class="view-details">詳細を見る →</span>
                </div>
            `;
        } else {
            return `
                <div class="case-card" onclick="showDetail('${c.id}', 'explore')">
                    <h3>${c.name}</h3>
                    <span class="category-badge">${c.category}</span>
                    <div class="info">
                        <div class="info-item">
                            <div class="info-label">教科</div>
                            ${c.subject}
                        </div>
                        <div class="info-item">
                            <div class="info-label">学年</div>
                            ${c.grade.join(', ')}
                        </div>
                        <div class="info-item">
                            <div class="info-label">活動の形</div>
                            ${c.activityForm.join(', ')}
                        </div>
                        <div class="info-item">
                            <div class="info-label">身体性</div>
                            ${c.physicality}
                        </div>
                    </div>
                    <span class="view-details">詳細を見る →</span>
                </div>
            `;
        }
    }).join('');
}

// ── モーダル ─────────────────────────────────────────────

function setupModal() {
    document.querySelector('.close').addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function showDetail(caseId, mode) {
    const cases = mode === 'training' ? trainingCases : exploreCases;
    const c = cases.find(x => x.id === caseId);
    if (!c) return;

    document.getElementById('modalTitle').textContent = `${c.name}（${c.category}）`;

    let tableHTML = '';
    if (mode === 'training') {
        tableHTML = `
            <table>
                <tr><th>観点</th><th>内容</th></tr>
                <tr><td>活動タイプ</td><td>${c.activityType}</td></tr>
                <tr><td>学習者レベル</td><td>${LEVEL_LABELS[c.level] || c.level}</td></tr>
                <tr><td>所要時間</td><td>${c.duration}</td></tr>
                <tr><td>活動の形</td><td>${c.activityForm.join(', ')}</td></tr>
                <tr><td>概要</td><td>${c.summary}</td></tr>
                <tr><td>産出物</td><td>${c.output}</td></tr>
                <tr><td>現場適用性</td><td>${c.fieldApplicability}</td></tr>
                <tr><td>ファシリ負荷</td><td>${c.facilitatorLoad}</td></tr>
                <tr><td>準備物</td><td>${c.tool}</td></tr>
                <tr><td>評価の方法</td><td>${c.evaluationMethod}</td></tr>
                <tr><td>設計のポイント</td><td>${c.designTip}</td></tr>
            </table>
        `;
    } else {
        tableHTML = `
            <table>
                <tr><th>観点</th><th>内容</th></tr>
                <tr><td>活動カテゴリ</td><td>${c.category}</td></tr>
                <tr><td>活動の形</td><td>${c.activityForm.join(', ')}</td></tr>
                <tr><td>身体性</td><td>${c.physicality}</td></tr>
                <tr><td>使うもの</td><td>${c.tool}</td></tr>
                <tr><td>問いの性質</td><td>${c.questionType}</td></tr>
                <tr><td>他者との関係</td><td>${c.otherRelation}</td></tr>
                <tr><td>産出物</td><td>${c.output}</td></tr>
                <tr><td>現実との接点</td><td>${c.realityConnection}</td></tr>
                <tr><td>時間軸</td><td>${c.timeline}</td></tr>
                <tr><td>評価の対象</td><td>${c.evaluationTarget}</td></tr>
                <tr><td>評価の方法</td><td>${c.evaluationMethod}</td></tr>
                <tr><td>評価のタイミング</td><td>${c.evaluationTiming}</td></tr>
            </table>
        `;
    }

    document.getElementById('modalBody').innerHTML = tableHTML;
    document.getElementById('adoptButton').onclick = () => adoptCase(c, mode);
    modal.style.display = 'block';
}

function closeModal() {
    modal.style.display = 'none';
}

// ── 採用（コピー） ───────────────────────────────────────

function adoptCase(c, mode) {
    let template = '';
    if (mode === 'training') {
        template = `【選択した授業活動パターン】
活動名: ${c.name}
活動タイプ: ${c.category}
学習者レベル: ${LEVEL_LABELS[c.level] || c.level}
所要時間: ${c.duration}

【概要】
${c.summary}

【設計のポイント】
${c.designTip}

【準備物】
${c.tool}

【評価の方法】
${c.evaluationMethod}

【産出物】
${c.output}`;
    } else {
        template = `【選択した事例】
事例名: ${c.name}
カテゴリ: ${c.category}
対象: ${c.subject} / ${c.grade.join(', ')}
活動の形: ${c.activityForm.join(', ')}

【設計メモ】
1. 学習目標の明確化
2. 事例の改編・アレンジ（必要に応じて）
3. 教材・リソースの準備
4. 学習ワークの設計
5. 評価方法の詳細化`;
    }

    copyToClipboard(template);
}

function adoptGenerated(activity, theme, goal) {
    const steps = Array.isArray(activity['手順'])
        ? activity['手順'].map((s, i) => `  ${i + 1}. ${s}`).join('\n')
        : activity['手順'];

    const template = `【AI生成：授業活動案】
授業テーマ: ${theme}
学習目標: ${goal}
活動名: ${activity['活動名']}
活動タイプ: ${activity['活動タイプ']}

【概要】
${activity['概要']}

【手順】
${steps}

【準備物】
${activity['準備物']}

【ポイント】
${activity['ポイント']}

【確認方法】
${activity['確認方法']}`;

    copyToClipboard(template);
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('設計メモをコピーしました。');
        closeModal();
    }).catch(() => {
        alert('コピーに失敗しました。手動でコピーしてください。');
    });
}
