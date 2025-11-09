/**
 * flyMD AI Assistant Extension
 * 
 * 功能:
 * 1. 提供一个统一的 "AI 助手" 菜单入口。
 * 2. 通过弹出的模态窗口提供具体功能，如润色、对话、测试等。
 * 3. 提供一个图形化的设置面板，用于配置 API Endpoint 和 API Key。
 * 4. 所有配置存储在内存中，无需用户修改代码文件。
 */

// --- 1. 全局配置变量 ---
// 使用 let 声明，初始值为空，用于在内存中动态存储用户的设置。
let LLM_API_ENDPOINT = '';
let API_KEY = '';


// --- 2. 核心 API 调用函数 ---
/**
 * 调用大语言模型 API 的核心函数
 * @param {Array<object>} messages - 发送给 API 的消息数组
 * @returns {Promise<string>} - 返回 AI 生成的文本内容
 */
async function callLLMApi(messages) {
  // 前置检查，确保配置已存在
  if (!LLM_API_ENDPOINT || !API_KEY) {
    throw new Error("API Endpoint 或 API Key 未设置。请先在 AI 助手菜单中进行设置。");
  }

  const response = await fetch(LLM_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo", // 您可以根据需要更改模型
      messages: messages
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("API Error Response:", errorBody);
    throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error("API 返回了无效的数据结构。");
  }
  return data.choices[0].message.content;
}


// --- 3. 打开设置面板的函数 ---
/**
 * 弹出一个模态窗口，用于让用户设置 API Endpoint 和 Key
 * @param {object} context - 扩展上下文对象
 */
function openSettingsModal(context) {
  context.showModal({
    title: '⚙️ API 设置',
    body: '请配置您的大语言模型 API 信息。这些信息将保存在内存中，关闭应用后会重置。',
    inputs: [
      {
        id: 'apiEndpoint',
        label: 'API Endpoint',
        type: 'text',
        placeholder: '例如: https://api.openai.com/v1/chat/completions',
        defaultValue: LLM_API_ENDPOINT // 自动填充已保存的值
      },
      {
        id: 'apiKey',
        label: 'API Key',
        type: 'password', // 使用 password 类型可以隐藏输入内容
        placeholder: '请输入您的 API Key',
        defaultValue: API_KEY
      }
    ],
    buttons: [
      {
        label: '保存',
        onClick: (values) => {
          // `values` 是一个对象，包含了所有 input 的值，键名就是 input 的 id
          LLM_API_ENDPOINT = values.apiEndpoint ? values.apiEndpoint.trim() : '';
          API_KEY = values.apiKey ? values.apiKey.trim() : '';
          
          if (LLM_API_ENDPOINT && API_KEY) {
            alert('✅ 设置已保存！现在您可以测试连接或使用其他 AI 功能了。');
          } else {
            alert('⚠️ 请确保 Endpoint 和 Key 都已填写。');
          }
        }
      },
      {
        label: '取消'
      }
    ]
  });
}


// --- 4. 扩展主逻辑 ---
export default {
  /**
   * 扩展激活时调用的函数
   * @param {object} context - 扩展上下文对象
   */
  activate(context) {
    // 只创建一个主菜单入口
    context.addMenuItem({
      id: 'ai.assistant.main',
      title: '🤖 AI 助手',
      action: () => {
        // 点击主菜单时，弹出功能选择模态框
        context.showModal({
          title: 'AI 助手功能菜单',
          body: '请选择一个要执行的 AI 操作：',
          buttons: [
            // --- 子菜单项 1: 润色全文 ---
            {
              label: '🤖 润色全文',
              onClick: async () => {
                if (!LLM_API_ENDPOINT || !API_KEY) {
                  alert('请先通过 [⚙️ 设置 API] 配置您的信息。');
                  return;
                }
                try {
                  const originalText = context.getEditorValue();
                  if (!originalText.trim()) {
                    alert('编辑器内容为空，无法润色。');
                    return;
                  }
                  context.setEditorValue(`${originalText}\n\n---\n\n[🤖 AI 正在润色中，请稍候...]`);
                  const messages = [
                    { role: "system", content: "你是一个专业的文本润色助手，擅长优化表达、修正语法错误并提升文章可读性。请直接返回润色后的全文，不要包含任何额外的解释或开场白。" },
                    { role: "user", content: `请帮我润色以下文本：\n\n${originalText}` }
                  ];
                  const polishedText = await callLLMApi(messages);
                  context.setEditorValue(polishedText);
                } catch (error) {
                  console.error('AI 润色失败:', error);
                  alert(`AI 润色失败: ${error.message}`);
                  context.setEditorValue(context.getEditorValue().split('\n\n---\n\n[🤖 AI 正在润色中，请稍候...]')[0]);
                }
              }
            },
            
            // --- 子菜单项 2: 发送问题给 AI (基于文档上下文) ---
            {
                label: '💬 发送问题 (基于文档)',
                onClick: async () => {
                    if (!LLM_API_ENDPOINT || !API_KEY) {
                      alert('请先通过 [⚙️ 设置 API] 配置您的信息。');
                      return;
                    }
                    try {
                        const fullText = context.getEditorValue();
                        const chatSessionMatch = fullText.match(/### 🤖 AI 对话（关于本文档）([\s\S]*)/);
                        if (!chatSessionMatch) {
                            alert('未找到 AI 对话区域。请先使用 "开始文档对话" 功能。');
                            return;
                        }
                        const documentContent = fullText.split('### 🤖 AI 对话')[0];
                        const chatSession = chatSessionMatch[1];
                        const questions = chatSession.match(/\*\*You:\*\*\s*([\s\S]*?)(?=\*\*AI:\*\*|\n---)/g);
                        if (!questions) {
                            alert("在对话区未找到您的问题。请在'You:'后输入问题。");
                            return;
                        }
                        const lastQuestion = questions[questions.length - 1].replace('**You:**', '').trim();
                        if (!lastQuestion) {
                            alert("您最新的问题为空，请输入内容后重试。");
                            return;
                        }
                        
                        context.setEditorValue(fullText + "\n**AI:** 正在思考中...");

                        const messages = [
                            { role: "system", content: `你是一个基于给定文档的问答助手。请根据用户提供的文档内容来回答问题。文档内容如下：\n\n---\n\n${documentContent}`},
                            { role: "user", content: lastQuestion }
                        ];

                        const aiResponse = await callLLMApi(messages);
                        context.setEditorValue(fullText + `\n**AI:** ${aiResponse}\n`);

                    } catch (error) {
                        console.error('AI 对话失败:', error);
                        alert(`AI 对话失败: ${error.message}`);
                        context.setEditorValue(context.getEditorValue().replace("\n**AI:** 正在思考中...", ""));
                    }
                }
            },

            // --- 子菜单项 3: 测试连接 ---
            {
              label: '🧪 测试连接',
              onClick: async () => {
                if (!LLM_API_ENDPOINT || !API_KEY) {
                  alert('请先通过 [⚙️ 设置 API] 配置您的信息，然后才能测试。');
                  return;
                }
                alert("正在测试与 AI 模型的连接，请稍候...");
                try {
                  await callLLMApi([{ role: "user", content: "Hello" }]);
                  alert("✅ 连接成功！\nAPI Endpoint 和 Key 均有效。");
                } catch (error) {
                  console.error('AI 连接测试失败:', error);
                  alert(`❌ 连接失败！\n\n错误详情: ${error.message}\n\n请检查您的 API Endpoint 地址、API Key 以及网络连接。`);
                }
              }
            },

            // --- 子菜单项 4: 打开设置面板 ---
            {
              label: '⚙️ 设置 API',
              onClick: () => {
                openSettingsModal(context);
              }
            },

            // --- 默认的取消按钮 ---
            {
              label: '取消'
            }
          ]
        });
      }
    });
  }
};
