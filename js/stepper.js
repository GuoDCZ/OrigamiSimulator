/**
 * Created by zhiyao on 11/6/25.
 */


function initStepper(globals){
  
    function isSmall(num, lv=1){
        return Math.abs(num) < Math.pow(10, -lv);
    }
  
    function isMountainAngle(angle){
        return isSmall(angle - Math.PI);
    }

    function isMountainCrease(crease){
        return isMountainAngle(crease.getTargetTheta());
    }

    function isValleyAngle(angle){
        return isSmall(angle + Math.PI);
    }

    function isValleyCrease(crease){
        return isValleyAngle(crease.getTargetTheta());
    }

    function isFlatFoldingCrease(crease){
        return isMountainCrease(crease) || isValleyCrease(crease);
    }

    function isParallelVectors(normalized_vec1, normalized_vec2){
        const crossProd = new THREE.Vector3().crossVectors(normalized_vec1, normalized_vec2);
        return isSmall(crossProd.length());
    }

    function isParallelBeams(beam1, beam2){
        const dir1 = beam1.getDirection();
        const dir2 = beam2.getDirection();
        return isParallelVectors(dir1, dir2);
    }

    function isParallelCreases(crease1, crease2){
        return isParallelBeams(crease1.edge, crease2.edge);
    }

    function combinations(arr, num){
        if (num === 0) return [[]];
        return arr.flatMap((head, i) => 
            combinations(arr.slice(i + 1), num - 1).map(comb => [head, ...comb])
        );
    }

    function getNodeCombinations(node){
        if (node.isBoundary()) return [];
        var effectiveCreases = node.invCreases.filter(isFlatFoldingCrease);
        if (effectiveCreases.length % 2 === 1) console.warn("Odd number of effective creases at node ", node.index);
        if (effectiveCreases.length === 0) console.warn("No effective creases at node ", node.index);
        if (effectiveCreases.length === 2) {
            console.log(`Node ${node.index} combinations: `, [effectiveCreases]);
            return [effectiveCreases];
        }
        // effectiveCreases.length >= 4
        var homoPairs = [];
        var res = [];
        const comb2s = combinations(effectiveCreases, 2);
        for (let i = 0; i < comb2s.length; i++){
            let comb = comb2s[i];
            if (isParallelCreases(comb[0], comb[1])){
                if (isMountainCrease(comb[0]) == isMountainCrease(comb[1])){
                    homoPairs.push(comb);
                } else {
                    res.push(comb);
                }
            }
        }
        for (let i = 0; i < homoPairs.length; i++){
            let comb = homoPairs[i];
            for (let j = 0; j < effectiveCreases.length; j++){
                let c = effectiveCreases[j];
                if (isMountainCrease(c) != isMountainCrease(comb[0])) {
                    res.push([...comb, c]);
                }
            }
        }
        for (let i = 4; i <= effectiveCreases.length; i++){
            res.push(...combinations(effectiveCreases, i));
        }
        console.log(`Node ${node.index} combinations: `, res);
        return res;
    }

    var nodeCombinations;

    function MaskQueue(){
        this.masks = [];
    }

    MaskQueue.prototype.enqueue = function(mask){
        var priority = -mask.complexity;
        // if (mask.nextNodes.size === 0) priority += 1000;
        var found = false;
        for (let i = 0; i < this.masks.length; i++){
            var m = this.masks[i];
            var p = -m.complexity;
            // if (m.nextNodes.size === 0) p += 1000;
            if (priority > p){
                this.masks.splice(i, 0, mask);
                found = true;
                break;
            }
        }
        if (!found){
            this.masks.push(mask);
        }
    }

    MaskQueue.prototype.dequeue = function(){
        return this.masks.shift();
    }

    MaskQueue.prototype.isEmpty = function(){
        return this.masks.length === 0;
    }

    MaskQueue.prototype.destroy = function(){
        this.masks = [];
    }

    var mq;

    function isPassiveCrease(creaseIdx){
        return globals.mask &&
            globals.mask.passiveCreases.has(creaseIdx) &&
            !globals.mask.activeCreases.has(creaseIdx);
    }

    function isActiveCrease(creaseIdx){
        return globals.mask &&
            globals.mask.activeCreases.has(creaseIdx);
    }

    function stepFinderInit() {
        globals.controls.updateFoldingMode("sequential");
        globals.creasePercent = 1.0;
        globals.controls.updateCreasePercent();
        if (globals.keyframeIdx > 0) {
            console.warn("Stepper started at non-zero keyframe index. Discarding previous keyframes.");
            while (globals.keyframeIdx > 0) {
                globals.model.deleteKeyframe(1);
            }
        }
        globals.model.addKeyframe(globals.keyframeIdx + 1);
        statManager.start();
        return stepFinderInit2;
        // return null;
    }

    function stepFinderInit2() {
        nodeCombinations = globals.model.getNodes().map(getNodeCombinations);
        var creases = globals.model.getCreases();
        var effectiveCreases = creases.filter(isFlatFoldingCrease);
        console.log(`Effective creases: `, effectiveCreases);
        for (let i = 0; i < effectiveCreases.length; i++){
            var crease = effectiveCreases[i];
            var mask = {
                activeCreases: new Set([crease.index]),
                passiveCreases: new Set([crease.index]),
                visitedCreases: new Set([crease.index]),
                nextNodes: new Set(crease.edge.nodes
                    .filter(node => !node.isBoundary())
                    .map(n => n.index)),
                visitedNodes: new Set(),
                complexity: 1,
            };
            mq.enqueue(mask);
        }
        return stepFinderLoop();
    }

    function stepFinderLoop() {
        while (true) {
            var nodes = globals.model.getNodes();

            if (mq.isEmpty()) {
                console.log("No more masks to test.");
                globals.mask = null;
                $("#stepper").text("Step");
                $("#stepperBottom").removeClass("active");
                return;
            }
            var mask = mq.dequeue();
            if (mask.nextNodes.size === 0) {
                return stepFinderWait(mask);
            }
            var nodeIdx = mask.nextNodes.values().next().value;
            mask.nextNodes.delete(nodeIdx);
            if (mask.visitedNodes.has(nodeIdx)) {
                console.warn("Unexpected: node already visited.");
            }
            mask.visitedNodes.add(nodeIdx);

            var node = nodes[nodeIdx];
            var combs = nodeCombinations[nodeIdx];

            for (let i = 0; i < combs.length; i++){
                let comb = combs[i];
                let cannot_apply = false;
                for (let j = 0; j < comb.length; j++){
                    let crease = comb[j];
                    if (mask.visitedCreases.has(crease.index)
                        && !mask.passiveCreases.has(crease.index)){
                        cannot_apply = true;
                        break;
                    }
                }
                if (cannot_apply) continue;
                let newMask = {
                    activeCreases: new Set(mask.activeCreases),
                    passiveCreases: new Set(mask.passiveCreases),
                    visitedCreases: new Set(mask.visitedCreases),
                    nextNodes: new Set(mask.nextNodes),
                    visitedNodes: new Set(mask.visitedNodes),
                    complexity: mask.complexity,
                };
                for (let j = 0; j < comb.length; j++){
                    let crease = comb[j];
                    newMask.passiveCreases.add(crease.index);
                };
                if (comb.length === 2){
                    if (isActiveCrease(comb[0].index)) newMask.activeCreases.add(comb[1].index);
                    else if (isActiveCrease(comb[1].index)) newMask.activeCreases.add(comb[0].index);
                }
                newMask.complexity += newMask.passiveCreases.size - mask.passiveCreases.size - 1;
                for (let j = 0; j < node.invCreases.length; j++){
                    let crease = node.invCreases[j];
                    newMask.visitedCreases.add(crease.index);
                };
                for (let j = 0; j < comb.length; j++){
                    let crease = comb[j];
                    for (let k = 0; k < crease.edge.nodes.length; k++){
                        let newNode = crease.edge.nodes[k];
                        if (nodes[newNode.index].isBoundary()) continue;
                        if (newNode.index === node.index) continue;
                        if (newMask.visitedNodes.has(newNode.index)) continue;
                        newMask.nextNodes.add(newNode.index);
                    }
                }
                mq.enqueue(newMask);
            }
        }
    }

    function stepFinderWait(mask) {
        globals.mask = mask;
        console.log(`Testing mask: vanishing crease ${[...mask.activeCreases].join(", ")}, ` +
            `loosening creases [${[...mask.passiveCreases].join(", ")}], ` +
            `complexity ${mask.complexity}`);
        console.log(`Other 10 candidate masks in queue: `);
        for (let i = 0; i < Math.min(10, mq.masks.length); i++){
            let m = mq.masks[i];
            console.log(`  mask ${i + 1}: vanishing crease ${[...m.activeCreases].join(", ")}, ` +
                `loosening creases [${[...m.passiveCreases].join(", ")}], ` +
                `complexity ${m.complexity}`);
        }
        globals.model.getSolver().reset();
        globals.creaseMaterialHasChanged = true;
        statManager.start();
        // Wait for the next call to InstabilityTestLoop
        return (isStable) => {
            if (isStable) {
                console.log("Mask resulted in stable configuration.");
                applyMask();
                globals.creaseMaterialHasChanged = true;
                $("#stepper").text("Step");
                $("#stepperBottom").removeClass("active");
                return;
            } else {
                console.log("Mask resulted in instability, trying next mask...");
                return stepFinderLoop();
            }
        };
    }

    function applyMask() {
        var creases = globals.model.getCreases();
        if (!globals.mask) return;
        console.log(`Applying mask: vanishing crease ${[...globals.mask.activeCreases].join(", ")}:` +
            `${[...globals.mask.activeCreases].map(idx => creases[idx].getTheta()).join(", ")})`);
        console.log(globals.mask);
        for (const idx of globals.mask.activeCreases){
            creases[idx].setTargetTheta(0);
        }
        let actualThetas = globals.model.getSolver().getTheta();
        for (const idx of globals.mask.passiveCreases){
            let actualTheta = actualThetas[idx];
            if (Math.abs(actualTheta) < Math.PI / 100) actualTheta = 0;
            if (Math.abs(actualTheta - Math.PI) < Math.PI / 100) actualTheta = Math.PI;
            if (Math.abs(actualTheta + Math.PI) < Math.PI / 100) actualTheta = -Math.PI;
            console.log(`  loosening crease ${idx}: ` +
                `${creases[idx].getTheta()})` + 
                ` to ${actualTheta})`);
            creases[idx].setTargetTheta(actualTheta);
        }
        globals.mask = null;
    }


    let cont = null;

    function initStatManager() {
        const alpha = 0.2;
        const eps = 0.02;
        const stableLimit = 5;
        var mean = null;
        var var_ = 100;
        var stableCount = 0;
        var n = 0;
        var running = false;

        function start() {
            mean = 0;
            var_ = 100;
            stableCount = 0;
            n = 0;
            running = true;
        }

        function ping(val, callback) {
            if (!running) return;
            n++;

            const diff = val - mean;
            mean += alpha * diff;
            var_ = (1 - alpha) * (var_ + alpha * diff * diff);

            const std = Math.sqrt(var_);
            const cil = mean - 1.96 * std;
            const ciu = mean + 1.96 * std;

            function logInstability() {
                console.log(`Energy: ${val.toFixed(5)}; [${cil.toFixed(5)}, ${ciu.toFixed(5)}]; `+
                            `Var: ${var_.toFixed(5)}; Mean: ${mean.toFixed(5)}`);
            };

            const containZero = (cil <= 0 && ciu >= 0);

            // === Reject ===
            if (!containZero) {
                running = false;
                logInstability();
                callback(false);
            }

            // === Accept ===
            if (Math.abs(mean) < eps && containZero) {
                stableCount++;
                if (stableCount >= stableLimit) {
                    running = false;
                    logInstability();
                    callback(true);
                }
            } else {
                stableCount = 0;
            }

            if (n % 10 === 1) {
                logInstability();
            }
        }

        return {
            ping: ping,
            start: start,
        };
    }

    const statManager = initStatManager();

    function ping() {
        const val = globals.dynamicSolver.getTotalEnergy();
        statManager.ping(val, (isStable) => {
            if (cont) {
                cont = cont(isStable);
            }
        });
    }

    function startStepper(){
        if (cont) {
            console.log("Stepper already initialized.");
            return;
        }
        $("#stepper").text("Running");
        $("#stepperBottom").addClass("active");
        console.log("Initializing stepper...");
        mq = new MaskQueue();
        cont = stepFinderInit();
    }

    return {
        ping: ping,
        startStepper: startStepper,
        isActiveCrease: isActiveCrease,
        isPassiveCrease: isPassiveCrease,
    }
}