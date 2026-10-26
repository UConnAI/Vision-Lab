export const TRAINING_NODES=[
  {id:'input',name:'Image batch',shape:'32 × 16 × 16 × 1',detail:'32 grayscale symbols',parameters:0},
  {id:'conv1',name:'Convolution + ReLU',shape:'32 × 16 × 16 × 8',detail:'8 shared 3 × 3 filters',parameters:80},
  {id:'pool1',name:'Max pool',shape:'32 × 8 × 8 × 8',detail:'Keep each 2 × 2 maximum',parameters:0},
  {id:'conv2',name:'Convolution + ReLU',shape:'32 × 6 × 6 × 12',detail:'12 shared 3 × 3 filters',parameters:876},
  {id:'flatten',name:'Pool → flatten',shape:'32 × 3 × 3 × 12 → 32 × 108',detail:'108 features per image',parameters:0},
  {id:'scores',name:'Dense → softmax',shape:'32 × 3',detail:'Ring · Plus · X',parameters:327},
  {id:'loss',name:'Cross-entropy loss',shape:'One batch mean',detail:'Compare with 32 labels',parameters:0}
];

export const TRAINING_STEPS=[
  ['forward','input','Read one batch','The real loop takes 32 training images and their labels. An epoch visits all 384 training images, in 12 batches.'],
  ['forward','conv1','Slide shared filters','Each of 8 learned filters multiplies nearby pixels and adds a bias. ReLU replaces negative values with zero. The same filter weights are reused at every position.'],
  ['forward','pool1','Keep the strongest response','Each 2 × 2 pool keeps its maximum and remembers which input supplied it. The spatial size shrinks from 16 × 16 to 8 × 8.'],
  ['forward','conv2','Combine local features','12 filters combine all 8 input channels. Valid 3 × 3 convolution produces 6 × 6 maps; ReLU gates their responses.'],
  ['forward','flatten','Pool and reshape','Pooling produces 3 × 3 × 12 values. Flattening rearranges those 108 values into a feature vector without learning weights.'],
  ['forward','scores','Calculate three class scores','The dense layer combines 108 features into three logits. Softmax turns the logits into class scores that sum to one.'],
  ['forward','loss','Compare scores with labels','Cross-entropy penalizes assigning a small score to the correct class. The optimizer differentiates the mean loss across the current batch.'],
  ['backward','scores','Start the backward pass','For softmax with mean cross-entropy, the logit gradient is (p − y) / 32. Dense weights receive gradients from each image’s features.'],
  ['backward','flatten','Undo the reshape and route pooling gradients','Reshape the feature gradient back into maps. A max-pool gradient goes to the position that won the corresponding forward maximum.'],
  ['backward','conv2','Differentiate the second convolution','ReLU blocks gradients where its saved pre-activation was not positive. Shared filter gradients add contributions across image positions and batch examples.'],
  ['backward','pool1','Route the earlier pooling gradient','Send each gradient to its saved winning position. Overlapping paths add their contributions rather than replacing one another.'],
  ['backward','conv1','Differentiate the first filters','Calculate a gradient for each first-layer weight using the pixels it read. The gradients tell the optimizer how local weight changes affect this batch’s loss.'],
  ['backward','input','Reach the image measurements','The chain rule can calculate sensitivity to the input pixels. Ordinary model training updates learned parameters; it does not rewrite the training photographs or symbols.'],
  ['update','all','Adam updates the learned parameters','Adam maintains running gradient and squared-gradient estimates. It updates the two convolution layers and dense layer. Pooling, flattening and input pixels have no learned parameters to update.'],
  ['repeat','input','Run a fresh forward pass','Use the new weights on the next batch. After 12 batches, evaluate validation data without updates. Repeat for 12 epochs, then evaluate the held-out test set.']
].map(([direction,node,title,description])=>({direction,node,title,description}));

export function trainingProgress(batches){
  const completed=Math.max(0,Math.min(144,Math.floor(batches)));
  return {completed,total:144,epoch:Math.min(12,Math.floor(completed/12)+1),percent:completed/144*100};
}

// Capture actual model values without changing weights or leaving tensors alive.
export function trainingSnapshot(tf,model,pixels){
  const weights=Array.from(model.layers[0].getWeights()[0].dataSync());
  const activations=tf.tidy(()=>Array.from(model.layers[0].apply(tf.tensor4d(pixels,[1,16,16,1])).dataSync()));
  return {weights,activations,input:Array.from(pixels)};
}

// History contains ordinary arrays, never live tensors or model weights.
export function createEpochHistory(){
  let entries=[],selected=0,following=true;
  return {
    clear(){entries=[];selected=0;following=true;},
    record(epoch,snapshot,metrics=null){
      if(!Number.isInteger(epoch)||epoch!==entries.length||epoch>12)throw new Error('Record epoch 0, then each completed epoch through 12 in order.');
      const saved={epoch,snapshot:{weights:[...snapshot.weights],activations:[...snapshot.activations],input:[...snapshot.input]},metrics:metrics?{...metrics}:null};
      entries.push(saved);if(following)selected=epoch;
    },
    select(epoch){if(!Number.isFinite(epoch))throw new Error('Choose a finite epoch.');selected=Math.max(0,Math.min(entries.length-1,Math.round(epoch)));following=false;},
    live(){following=true;selected=Math.max(0,entries.length-1);},
    state(){return {entry:entries[selected]??null,previous:entries[selected-1]??null,latest:entries.length-1,count:entries.length,following};},
    activationScale(channel){
      let peak=0;
      for(const entry of entries)for(let index=channel;index<entry.snapshot.activations.length;index+=8)peak=Math.max(peak,entry.snapshot.activations[index]);
      return peak;
    }
  };
}
