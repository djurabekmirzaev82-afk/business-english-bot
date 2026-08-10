const fs = require('fs');
const path = require('path');

const resources = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'listeningResources.json'), 'utf8')
);

async function showResources(ctx) {
  await ctx.answerCbQuery();
  let text = "🔗 Qo'shimcha Listening manbalari:\n\n";
  for (const group of resources) {
    text += `${group.category}\n`;
    for (const item of group.items) {
      text += `— ${item.title}\n${item.url}\n`;
    }
    text += '\n';
  }
  await ctx.reply(text, { disable_web_page_preview: true });
}

module.exports = { showResources };
