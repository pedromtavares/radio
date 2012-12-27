/*
 * Copyright (c) 2012 Dmitri Melikyan
 *
 * Permission is hereby granted, free of charge, to any person obtaining a 
 * copy of this software and associated documentation files (the 
 * "Software"), to deal in the Software without restriction, including 
 * without limitation the rights to use, copy, modify, merge, publish, 
 * distribute, sublicense, and/or sell copies of the Software, and to permit 
 * persons to whom the Software is furnished to do so, subject to the 
 * following conditions:
 * 
 * The above copyright notice and this permission notice shall be included 
 * in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS 
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN 
 * NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, 
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR 
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR 
 * THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


/*
 * This file is depricated. Kept for old npm versions defaulting to node-waf
 */

#include <node.h>
#include <v8.h>
#include <v8-profiler.h>
#include <stdio.h>
#include <sys/resource.h>
#include <sys/time.h>
#include <errno.h>

using namespace v8;


void Walk(int* next_uid, const int parent_uid, const CpuProfileNode* node, Local<Function> callback) {
  if(!node) return;

  int uid = (*next_uid)++;

  Handle<Value> argv[6];
  argv[0] = Integer::New(parent_uid);
  argv[1] = Integer::New(uid);
  argv[2] = Number::New(node->GetTotalSamplesCount()); 
  argv[3] = node->GetFunctionName();
  argv[4] = node->GetScriptResourceName();
  argv[5] = Integer::New(node->GetLineNumber()); 

  callback->Call(Context::GetCurrent()->Global(), 6, argv);

  int32_t childrenCount = node->GetChildrenCount();
  for(int i = 0; i < childrenCount; i++) {
    const CpuProfileNode* childNode = node->GetChild(i);
    Walk(next_uid, uid, childNode, callback);
  }
}


Handle<Value> StartV8Profiler(const Arguments& args) {
  HandleScope scope;

  CpuProfiler::StartProfiling(String::New("v8tools-cpu-profile"));

  return scope.Close(Undefined());
}


Handle<Value> StopV8Profiler(const Arguments& args) {
  HandleScope scope;

  const CpuProfile* profile = CpuProfiler::StopProfiling(String::New("v8tools-cpu-profile"));

  if(args.Length() > 0 && args[0]->IsFunction()) {
     Local<Function> callback = Local<Function>::Cast(args[0]);
     int nextUid = 1;
     Walk(&nextUid, 0, profile->GetTopDownRoot(), callback);
  }

  const_cast<v8::CpuProfile*>(profile)->Delete();

  return scope.Close(Undefined());
}




/*

node type:
  0 - hidden  
  1 - array
  2 - string
  3 - object
  4 - compiled code
  5 - function clojure
  6 - regexp
  7 - heap number
  8 - native object

edge type:
  0 - context variable
  1 - array element
  2 - property
  3 - internal
  4 - internal (size calculation)
  5 - internal (size calculation)
*/


static void IterateHeapSnapshot(const HeapSnapshot* snapshot, Local<Function> callback) {
  int32_t nodes_count = snapshot->GetNodesCount();
  for(int i = 0; i < nodes_count; i++) {
    const HeapGraphNode* node = snapshot->GetNode(i);

    int32_t children_count = node->GetChildrenCount();
    for(int j = 0; j < children_count; j++) {
      const HeapGraphEdge* child_edge = node->GetChild(j);
      const HeapGraphNode* child_node = child_edge->GetToNode();

      Handle<Value> argv[7];
      argv[0] = Integer::New(node->GetId());
      argv[1] = Integer::New(child_node->GetId());
      argv[2] = child_node->GetName(); 
      argv[3] = Integer::New(child_node->GetType());
      argv[4] = Integer::New(child_node->GetSelfSize());
      argv[5] = child_edge->GetName(); 
      argv[6] = Integer::New(child_edge->GetType());

      callback->Call(Context::GetCurrent()->Global(), 7, argv);
    }
  } 
}



Handle<Value> TakeHeapSnapshot(const Arguments& args) {
  HandleScope scope;

  const HeapSnapshot* snapshot = HeapProfiler::TakeSnapshot(String::New("v8tools-heap-snapshot"));
  if(args.Length() > 0 && args[0]->IsFunction()) {
     Local<Function> callback = Local<Function>::Cast(args[0]);
     IterateHeapSnapshot(snapshot, callback);
  }

  const_cast<v8::HeapSnapshot*>(snapshot)->Delete();

  return scope.Close(Undefined());
}



void Init(Handle<Object> target) {
  target->Set(String::NewSymbol("startV8Profiler"), FunctionTemplate::New(StartV8Profiler)->GetFunction());
  target->Set(String::NewSymbol("stopV8Profiler"), FunctionTemplate::New(StopV8Profiler)->GetFunction());
  target->Set(String::NewSymbol("takeHeapSnapshot"), FunctionTemplate::New(TakeHeapSnapshot)->GetFunction());
}


NODE_MODULE(v8tools, Init);

