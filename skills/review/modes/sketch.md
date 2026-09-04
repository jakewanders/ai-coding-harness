# review — sketch mode

Sketch skips the review stage entirely. If you were dispatched here in sketch mode, something routed wrongly:

- Do not review. Call `unit report` with outcome `blocked` and the question "sketch mode reached review; should this unit switch to express or thorough?".
- The conductor will surface the question to the user.
