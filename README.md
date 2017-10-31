# Node.js WS Subtargets

This package exists only as a proof of concept for the proposed Node.JS targets
domain implementation and should never be used in real-world scenarios.

## Usage

Do `npm install` to install the `ws` dependency then run
`node --inspect discover.js`. Connect to the instance with the debugger that
has subtarget domain support (Chrome DevTools will support it for Node targets
starting with version TBD).

## Known issues (that will not be fixed)

1. Pausing head instance makes it impossible to work with sub targets (e.g. it
is not possible to pause or send evaluate request). This is because the
transport between head and subtarget runs as a regular Node.js code. Final
implementation will have to include a different transport implementation that
runs separately from the main loop.
2. Target ports are hardcoded. Reason: this is a proof-of-concept.
