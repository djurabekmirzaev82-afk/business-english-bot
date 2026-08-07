const { schedule, contact } = require('../../config/orgInfo');

async function showSchedule(ctx) {
  await ctx.reply(schedule.text);
}

async function showContact(ctx) {
  await ctx.reply(contact.text);
}

module.exports = { showSchedule, showContact };
