V8tools - V8 CPU Profiler Binding
===


## Installation

    npm install v8tools


## API

`var v8tools = require('v8tools');`

`v8tools.startV8Profiler()` - starts V8 CPU profiler

`v8tools.stopV8Profiler(function(parentNodeUid, nodeUid, totalSamplesCount, functionName, scriptResourceName, lineNumber) {})` - stops V8 CPU profiler. Callback function is called on every node while walking profile's top down call tree.

`heapprof.takeHeapSnapshot(function(parentNodeUid, nodeUid, name, type, selfSize, retainerName, retainerType) {})` - takes heap snapshot. Callback function is called on every node of heap node graph.



## Platforms

POSIX and Windows


## License

Copyright (c) 2012 Dmitri Melikyan

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
