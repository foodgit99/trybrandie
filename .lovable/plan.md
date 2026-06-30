## What happened

Autonomous mode is on, and today’s Brandie post exists:

- Brand: Brandie
- Today’s idea: “Social Media Day: The OS Evolution”
- Scheduled for: Tuesday, June 30
- Approval: approved
- Autopilot: on
- Design: not created
- Autopilot status: still empty, meaning the generator never picked this specific idea up

## Why it did not auto-generate

There are two issues in the current autonomous path:

1. **The scheduled morning autopilot run started, but did not finish cleanly.**
   - The morning job ran at the correct time window for Lagos.
   - It began processing the global autopilot queue.
   - It hit slow/rate-limited design generation and older pending ideas from other brands first.
   - The run did not reach today’s Brandie idea before the backend request timed out / stalled.

2. **The “kick today’s render immediately” path from Blueprint is not forced.**
   - The Blueprint page calls the autopilot function after autonomous approval.
   - But it sends only the brand id, not `force: true`.
   - So if the user opens Blueprint outside the exact morning window, the function says “not the right time” and processes 0 ideas.

A smaller related issue: the weekly Blueprint row for this week is still marked `draft`, even though the individual ideas are approved. The current generator can still process individually approved ideas, so this is not the main blocker, but it makes status reporting confusing.

## Fix plan

1. **Make Blueprint’s immediate autonomous kick actually force-run today’s brand**
   - Update the Blueprint approval/autonomous auto-plan calls to invoke autopilot with:
     - `brand_id`
     - `force: true`
   - This makes “Autonomous approved the week, start today’s post now” work even outside the scheduled hour.

2. **Prioritize the current brand and today’s idea when forced**
   - In the autopilot function, when `brand_id + force` are present, process only that brand and prioritize today’s due idea first.
   - This prevents Brandie’s today post from being stuck behind the wider global queue.

3. **Make the scheduled autopilot run more reliable**
   - Order due ideas predictably by date and creation time.
   - Avoid one long global run silently dying before it finalizes.
   - Record partial progress earlier so the run history reflects what was actually picked up.

4. **Clean up Blueprint approval consistency**
   - When autonomous mode auto-approves a week, also mark the weekly Blueprint row as approved.
   - This keeps Blueprint status, banner status, and generator eligibility aligned.

5. **Backfill today’s Brandie post after the fix**
   - Reset today’s idea to a retryable state if needed.
   - Trigger a forced run for Brandie so today’s carousel starts rendering immediately.