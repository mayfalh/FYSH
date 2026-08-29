export interface AgentItem {
  id: string;
  name: string;
  nameAr?: string;
  category: 'claude' | 'codex_chatgpt' | 'cursor' | 'standalone' | 'mcp';
  badge?: string;
  description: string;
  descriptionAr: string;
  logo?: string;
  installType: 'cli' | 'mcp' | 'desktop_config' | 'extension' | 'url';
  command?: string;
  mcpConfig?: Record<string, any>;
  installDocsUrl?: string;
  steps: {
    en: string[];
    ar: string[];
  };
}

export const TOP_AGENT_GROUPS = {
  claude: {
    title: 'Claude',
    titleAr: 'Claude',
    items: [
      {
        id: 'claude_cowork',
        name: 'Claude + Claude Cowork',
        nameAr: 'Claude + Claude Cowork',
        category: 'claude' as const,
        description: 'Connect Claude Desktop and Cowork tools with instant tool calling & full app access.',
        descriptionAr: 'ربط تطبيق كلود المكتبي و Claude Cowork للوصول إلى أدوات وتطبيقات فيش فوراً.',
        installType: 'desktop_config' as const,
        command: 'composio add claude',
        mcpConfig: {
          mcpServers: {
            fysh: {
              command: 'npx',
              args: ['-y', '@composio/mcp@latest', '--user', 'default']
            }
          }
        },
        steps: {
          en: [
            'Open Claude Desktop Settings > Developer > Edit Config.',
            'Paste the FYSH MCP configuration into claude_desktop_config.json.',
            'Restart Claude Desktop. Your connected apps will appear as active tools!'
          ],
          ar: [
            'افتح إعدادات Claude Desktop > Developer > Edit Config.',
            'الصق إعدادات MCP الخاصة بـ FYSH في ملف claude_desktop_config.json.',
            'أعد تشغيل Claude Desktop وستظهر أدواتك المرتبطة مباشرة!'
          ]
        }
      },
      {
        id: 'claude_code',
        name: 'Claude Code',
        nameAr: 'Claude Code',
        category: 'claude' as const,
        description: 'Anthropic official CLI agent for terminal coding and tool automation.',
        descriptionAr: 'وكيل البرمجة الطرفي الرسمي من Anthropic للتحكم في الأكواد والتطبيقات عبر الطرفية.',
        installType: 'cli' as const,
        command: 'npm install -g @anthropic-ai/claude-code && claude mcp add fysh https://connect.composio.dev/mcp',
        steps: {
          en: [
            'Install Claude Code globally: npm i -g @anthropic-ai/claude-code',
            'Add the FYSH MCP server: claude mcp add fysh https://connect.composio.dev/mcp',
            'Run `claude` in your terminal to start building with full tool integrations.'
          ],
          ar: [
            'ثبّت Claude Code عاماً عبر npm: npm i -g @anthropic-ai/claude-code',
            'أضف خادم MCP الخاص بفيش: claude mcp add fysh https://connect.composio.dev/mcp',
            'شغّل أمر `claude` في الطرفية للبدء مع كامل الأدوات المربوطة.'
          ]
        }
      }
    ]
  },
  codex_chatgpt: {
    title: 'Codex + ChatGPT',
    titleAr: 'Codex + ChatGPT',
    items: [
      {
        id: 'codex',
        name: 'Codex',
        nameAr: 'Codex',
        category: 'codex_chatgpt' as const,
        description: 'Autonomous coding agent powered by OpenAI models with direct tool execution.',
        descriptionAr: 'وكيل الذكاء الاصطناعي البرمجي مع دعم تنفيذ الأدوات والتكاملات البرمجية.',
        installType: 'cli' as const,
        command: 'npm install -g @composio/codex && composio-codex init',
        steps: {
          en: [
            'Install the Codex connector CLI via npm or curl.',
            'Link your FYSH account to grant Codex access to your authorized apps.',
            'Execute Codex prompts with full tool access.'
          ],
          ar: [
            'ثبّت حزمة موصل Codex عبر npm.',
            'اربط حساب فيش لمنح Codex صلاحية استدعاء التطبيقات المصرح بها.',
            'ابدأ تنفيذ مهام Codex مع وصول كامل للأدوات.'
          ]
        }
      },
      {
        id: 'chatgpt',
        name: 'ChatGPT',
        nameAr: 'ChatGPT',
        category: 'codex_chatgpt' as const,
        description: 'Connect ChatGPT GPTs or ChatGPT Desktop with Custom Actions & MCP.',
        descriptionAr: 'ربط ChatGPT وتخصيصات GPTs بـ Actions وخوادم MCP للوصول لأدواتك.',
        installType: 'url' as const,
        command: 'https://connect.composio.dev/mcp',
        steps: {
          en: [
            'In ChatGPT, create a Custom GPT or configure ChatGPT Desktop Actions.',
            'Import the OpenAPI schema or MCP endpoint: https://connect.composio.dev/mcp',
            'Authorize your actions and test calling connected tools directly in chat!'
          ],
          ar: [
            'في ChatGPT، أنشئ GPT مخصص أو افتح إعدادات Actions في تطبيق ChatGPT المكتبي.',
            'استورد نقطة نهاية MCP: https://connect.composio.dev/mcp',
            'قم بتفويض الإجراءات وابدأ استدعاء التطبيقات مباشرة داخل المحادثة!'
          ]
        }
      }
    ]
  },
  cursor: {
    title: 'Cursor',
    titleAr: 'Cursor',
    items: [
      {
        id: 'cursor_ide',
        name: 'Cursor',
        nameAr: 'Cursor',
        category: 'cursor' as const,
        description: 'AI code editor with native Model Context Protocol (MCP) tool support.',
        descriptionAr: 'محرر الأكواد الذكي Cursor مع دعم خوادم MCP لاستدعاء الأدوات والتطبيقات.',
        installType: 'desktop_config' as const,
        command: 'composio add cursor',
        mcpConfig: {
          mcpServers: {
            fysh: {
              command: 'npx',
              args: ['-y', '@composio/mcp@latest']
            }
          }
        },
        steps: {
          en: [
            'Open Cursor Settings > Features > MCP Servers.',
            'Click "+ Add New MCP Server". Set Name to "FYSH", Type to "command", and Command to "npx -y @composio/mcp@latest".',
            'Alternatively, configure .cursor/mcp.json in your project workspace.'
          ],
          ar: [
            'افتح إعدادات Cursor > Features > MCP Servers.',
            'اضغط "+ Add New MCP Server"، اكتب الاسم "FYSH"، النوع "command"، والأمر "npx -y @composio/mcp@latest".',
            'أو أضف الإعدادات مباشرة إلى ملف `.cursor/mcp.json` داخل مشروعك.'
          ]
        }
      }
    ]
  }
};

export const AGENT_LIST: AgentItem[] = [
  {
    id: 'hermes',
    name: 'Hermes',
    nameAr: 'Hermes',
    category: 'standalone',
    description: 'Autonomous research and execution agent with browser & API toolkits.',
    descriptionAr: 'وكيل أبحاث وتنفيذ ذاتي مع أدوات تصفح وواجهات برمجية متعددة.',
    installType: 'cli',
    command: 'curl -fsSL https://hermes.agent/install.sh | sh && hermes connect fysh',
    steps: {
      en: [
        'Run the Hermes installation command in your terminal.',
        'Authenticate with your FYSH API key or MCP URL.',
        'Start autonomous workflows with `hermes run`.'
      ],
      ar: [
        'شغّل أمر تثبيت Hermes في الطرفية.',
        'وثّق الاتصال باستخدام مفتاح FYSH أو رابط MCP.',
        'ابدأ سير العمل الذاتي بالأمر `hermes run`.'
      ]
    }
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    nameAr: 'OpenClaw',
    category: 'standalone',
    description: 'Open-source autonomous robotic browser & task execution agent.',
    descriptionAr: 'وكيل مفتوح المصدر لأتمتة المهام وتصفح الويب واستدعاء الواجهات البرمجية.',
    installType: 'cli',
    command: 'npm i -g openclaw-agent && openclaw config --mcp https://connect.composio.dev/mcp',
    steps: {
      en: [
        'Install OpenClaw CLI globally.',
        'Set MCP endpoint: openclaw config --mcp https://connect.composio.dev/mcp',
        'Run `openclaw start` to begin executing tasks.'
      ],
      ar: [
        'ثبّت أداة OpenClaw الطرفية.',
        'عيّن نقطة MCP: openclaw config --mcp https://connect.composio.dev/mcp',
        'شغّل `openclaw start` لبدء تنفيذ المهام.'
      ]
    }
  },
  {
    id: 'notion',
    name: 'Notion',
    nameAr: 'Notion',
    category: 'standalone',
    description: 'Notion workspace AI with custom connected app actions and databases.',
    descriptionAr: 'وكيل Notion الذكي لإدارة قواعد البيانات وربط التطبيقات ومزامنة المستندات.',
    installType: 'url',
    command: 'https://connect.composio.dev/mcp',
    steps: {
      en: [
        'Open Notion Settings & Members > Connections.',
        'Add FYSH / Composio Integration connection.',
        'Use @Notion AI in any page to pull data from your connected apps.'
      ],
      ar: [
        'افتح إعدادات Notion > Connections.',
        'أضف ربط تكامل FYSH / Composio.',
        'استخدم @Notion AI في أي صفحة لجلب وتنظيم البيانات من تطبيقاتك المرتبطة.'
      ]
    }
  },
  {
    id: 'warp',
    name: 'Warp',
    nameAr: 'Warp',
    category: 'standalone',
    description: 'Modern AI-powered terminal with integrated agent workflows and MCP tools.',
    descriptionAr: 'طرفية أوامر ذكية تدعم وكلاء الذكاء الاصطناعي وتكاملات MCP السحابية.',
    installType: 'cli',
    command: 'warp agent add fysh --url https://connect.composio.dev/mcp',
    steps: {
      en: [
        'Open Warp Terminal and press Command+P (or Ctrl+P).',
        'Select "Agent Configuration" > "Add MCP Tool Provider".',
        'Paste the FYSH endpoint: https://connect.composio.dev/mcp'
      ],
      ar: [
        'افتح طرفية Warp واضغط Command+P (أو Ctrl+P).',
        'اختر "Agent Configuration" ثم "Add MCP Tool Provider".',
        'الصق رابط فيش: https://connect.composio.dev/mcp'
      ]
    }
  },
  {
    id: 'grok',
    name: 'Grok',
    nameAr: 'Grok',
    category: 'standalone',
    description: 'xAI Grok reasoning agent with direct function calling & real-time tool execution.',
    descriptionAr: 'وكيل Grok من xAI مع دعم استدعاء الدوال الحية والأدوات السحابية.',
    installType: 'cli',
    command: 'npm i -g @composio/grok-sdk && grok-agent setup --toolkit all',
    steps: {
      en: [
        'Install the Grok SDK integration bridge.',
        'Configure your xAI API Key and FYSH user ID.',
        'Enable tool calling in your Grok agent instance.'
      ],
      ar: [
        'ثبّت حزمة جسر Grok SDK.',
        'اضبط مفتاح xAI API ومعرف مستخدم فيش.',
        'فعّل استدعاء الأدوات في كود وكيل Grok.'
      ]
    }
  },
  {
    id: 'gemini_cli',
    name: 'Gemini CLI',
    nameAr: 'Gemini CLI',
    category: 'standalone',
    description: 'Google Gemini multimodal developer CLI with built-in MCP tool ecosystem.',
    descriptionAr: 'طرفية Google Gemini للمطورين مع دعم استدعاء الأدوات وخوادم MCP.',
    installType: 'cli',
    command: 'npm install -g @google/gemini-cli && gemini mcp register fysh https://connect.composio.dev/mcp',
    steps: {
      en: [
        'Install Gemini CLI: npm install -g @google/gemini-cli',
        'Register FYSH MCP: gemini mcp register fysh https://connect.composio.dev/mcp',
        'Execute prompts: `gemini run "Send email to team via Gmail"`.'
      ],
      ar: [
        'ثبّت Gemini CLI: npm install -g @google/gemini-cli',
        'سجّل خادم فيش: gemini mcp register fysh https://connect.composio.dev/mcp',
        'نفّذ الأوامر مباشرة: `gemini run "أرسل بريداً عبر جيميل"`.'
      ]
    }
  },
  {
    id: 'vscode',
    name: 'VS Code',
    nameAr: 'VS Code',
    category: 'standalone',
    description: 'Visual Studio Code AI extensions (GitHub Copilot, Roo Code, Cline) with MCP.',
    descriptionAr: 'إضافات الذكاء الاصطناعي في VS Code مع دعم بروتوكول MCP الكامل.',
    installType: 'extension',
    command: 'code --install-extension rooveterinaryinc.roo-cline',
    mcpConfig: {
      mcpServers: {
        fysh: {
          command: 'npx',
          args: ['-y', '@composio/mcp@latest']
        }
      }
    },
    steps: {
      en: [
        'Open VS Code Settings or Roo Code / Cline MCP settings panel.',
        'Add FYSH to your MCP server list using command: npx -y @composio/mcp@latest',
        'Save and start prompting your in-editor AI with full app integrations.'
      ],
      ar: [
        'افتح إعدادات VS Code أو لوحة تحكم إضافات Roo Code / Cline.',
        'أضف خادم FYSH إلى قائمة خوادم MCP عبر الأمر: npx -y @composio/mcp@latest',
        'احفظ الإعدادات وابدأ استخدام الذكاء الاصطناعي مع الوصول لكافة أدواتك.'
      ]
    }
  },
  {
    id: 'devin_desktop',
    name: 'Devin Desktop',
    nameAr: 'Devin Desktop',
    category: 'standalone',
    description: 'Cognition Devin autonomous software engineer desktop environment.',
    descriptionAr: 'بيئة مهندس البرمجيات الذاتي Devin Desktop للتحكم الكامل في الأدوات.',
    installType: 'cli',
    command: 'devin mcp add fysh https://connect.composio.dev/mcp',
    steps: {
      en: [
        'Open Devin Desktop Settings > Integrations.',
        'Add MCP Server: https://connect.composio.dev/mcp',
        'Devin can now interact with GitHub, Slack, Linear, Jira, and 1300+ connected apps.'
      ],
      ar: [
        'افتح إعدادات Devin Desktop > Integrations.',
        'أضف خادم MCP: https://connect.composio.dev/mcp',
        'يستطيع Devin الآن التفاعل مع GitHub و Slack و Jira وأكثر من 1300 تطبيق مرتبطة.'
      ]
    }
  },
  {
    id: 'cline',
    name: 'Cline',
    nameAr: 'Cline',
    category: 'standalone',
    description: 'Autonomous coding agent right in your IDE with CLI and MCP capabilities.',
    descriptionAr: 'وكيل برمجي ذاتي داخل المحرر يدعم بيئات CLI وبروتوكول MCP المتقدم.',
    installType: 'extension',
    command: 'composio add cline',
    mcpConfig: {
      mcpServers: {
        fysh: {
          command: 'npx',
          args: ['-y', '@composio/mcp@latest']
        }
      }
    },
    steps: {
      en: [
        'Click the Cline MCP icon (plugs) in the Cline sidebar panel.',
        'Click "Configure MCP Servers".',
        'Add the FYSH configuration block to cline_mcp_settings.json.'
      ],
      ar: [
        'اضغط على أيقونة MCP في الشريط الجانبي لإضافة Cline.',
        'اختر "Configure MCP Servers".',
        'أضف إعدادات FYSH داخل ملف cline_mcp_settings.json.'
      ]
    }
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    nameAr: 'Antigravity',
    category: 'standalone',
    description: 'Google DeepMind Antigravity Agent framework with full tool execution & APIs.',
    descriptionAr: 'منظومة وكلاء Antigravity الذكية لتنفيذ المهام المعقدة واستدعاء الأدوات.',
    installType: 'cli',
    command: 'npm install -g @antigravity/agent-cli && antigravity tool register fysh',
    steps: {
      en: [
        'Install the Antigravity agent CLI toolchain.',
        'Link with your FYSH user profile: `antigravity tool register fysh`',
        'Run agent workflows with direct access to Gmail, GitHub, Calendar, and more.'
      ],
      ar: [
        'ثبّت حزمة وكلاء Antigravity عبر npm.',
        'اربط حساب فيش: `antigravity tool register fysh`',
        'شغّل المهام الذاتية مع وصول فوري لـ Gmail و GitHub والتقويم والمزيد.'
      ]
    }
  },
  {
    id: 'openai_agent_builder',
    name: 'OpenAI Agent Builder',
    nameAr: 'OpenAI Agent Builder',
    category: 'standalone',
    description: 'Build enterprise AI agents with Assistants API, Function Calling & MCP.',
    descriptionAr: 'بناء وكلاء الذكاء الاصطناعي للمؤسسات عبر OpenAI Assistants و Functions.',
    installType: 'url',
    command: 'https://connect.composio.dev/mcp',
    steps: {
      en: [
        'In OpenAI Platform > Assistants > Tools, enable Function Calling.',
        'Import the FYSH tool definitions or connect via the MCP server proxy.',
        'Your Assistant can now execute real actions on behalf of your users.'
      ],
      ar: [
        'في منصة OpenAI > Assistants > Tools، فعّل خاصية Function Calling.',
        'استورد تعريفات أدوات فيش أو اربطها عبر خادم MCP.',
        'يمكن لمساعدك الآن تنفيذ إجراءات حقيقية في تطبيقات المستخدمين مباشرة.'
      ]
    }
  },
  {
    id: 'n8n',
    name: 'n8n',
    nameAr: 'n8n',
    category: 'standalone',
    description: 'Fair-code workflow automation tool with Advanced AI Agent nodes & MCP.',
    descriptionAr: 'منصة أتمتة مسارات العمل المتقدمة مع عُقد الـ AI Agents ودعم MCP.',
    installType: 'url',
    command: 'https://connect.composio.dev/mcp',
    steps: {
      en: [
        'In n8n, add an "AI Agent" node in your workflow canvas.',
        'Attach the "MCP Tool" or "HTTP Request" sub-node.',
        'Paste the FYSH MCP Endpoint: https://connect.composio.dev/mcp'
      ],
      ar: [
        'في n8n، أضف عقدة "AI Agent" في لوحة مسار العمل.',
        'اربط عقدة فرعية من نوع "MCP Tool" أو "HTTP Request".',
        'الصق نقطة نهاية FYSH MCP: https://connect.composio.dev/mcp'
      ]
    }
  },
  {
    id: 'mcp_url',
    name: 'MCP URL',
    nameAr: 'MCP URL',
    category: 'mcp',
    badge: 'Universal Protocol',
    description: 'Universal Model Context Protocol endpoint for any custom agent framework.',
    descriptionAr: 'رابط بروتوكول MCP الموحد للربط مع أي إطار عمل أو وكيل ذكاء اصطناعي مخصص.',
    installType: 'url',
    command: 'https://connect.composio.dev/mcp',
    steps: {
      en: [
        'Copy the universal MCP endpoint URL.',
        'Paste it into any MCP-compatible client (Zed, Continue, LangChain, LlamaIndex, AutoGen).',
        'Authenticate once and access all your active FYSH integrations.'
      ],
      ar: [
        'انسخ رابط نقطة نهاية MCP الموحدة.',
        'الصقه في أي تطبيق متوافق مع بروتوكول MCP (مثل Zed, Continue, LangChain, AutoGen).',
        'وثّق الاتصال مرة واحدة وتمتع بالوصول لكافة تكاملات فيش النشطة.'
      ]
    }
  }
];
