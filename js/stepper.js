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
        var effectiveCreases = node.invCreases.filter(isFlatFoldingCrease);
        if (effectiveCreases.length % 2 === 1) console.warn("Odd number of effective creases at node ", node.index);
        if (effectiveCreases.length === 0) console.warn("No effective creases at node ", node.index);
        if (effectiveCreases.length === 2) return [effectiveCreases];
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
        var priority = mask.visitedNodes.size - mask.passiveCreases.size;
        if (mask.nextNodes.size === 0) priority += 1000;
        var potential_positions = [];
        for (let i = 0; i < this.masks.length; i++){
            var m = this.masks[i];
            var p = m.visitedNodes.size - m.passiveCreases.size;
            if (m.nextNodes.size === 0) p += 1000;
            if (priority > p){
                potential_positions.push(i);
            }
        }
        if (potential_positions.length > 0){
            var rd = Math.floor(Math.random() * potential_positions.length);
            this.masks.splice(potential_positions[rd], 0, mask);
        } else {
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
            globals.mask.activeCrease !== creaseIdx;
    }

    function isActiveCrease(creaseIdx){
        return globals.mask &&
            globals.mask.activeCrease === creaseIdx;
    }

    function stepFinderInit() {
        var creases = globals.model.getCreases();
        var effectiveCreases = creases.filter(isFlatFoldingCrease);
        console.log(`Effective creases: `, effectiveCreases);
        for (let i = 0; i < effectiveCreases.length; i++){
            var crease = effectiveCreases[i];
            console.log(`Initializing mask ${i + 1}`);
            var mask = {
                activeCrease: crease.index,
                passiveCreases: new Set([crease.index]),
                visitedCreases: new Set([crease.index]),
                nextNodes: new Set(crease.edge.nodes
                    .filter(node => !node.isBoundary())
                    .map(n => n.index)),
                visitedNodes: new Set(),
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
                    activeCrease: mask.activeCrease,
                    passiveCreases: new Set(mask.passiveCreases),
                    visitedCreases: new Set(mask.visitedCreases),
                    nextNodes: new Set(mask.nextNodes),
                    visitedNodes: new Set(mask.visitedNodes),
                };
                for (let j = 0; j < comb.length; j++){
                    let crease = comb[j];
                    newMask.passiveCreases.add(crease.index);
                };
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
        console.log(`Testing mask: vanishing crease ${mask.activeCrease}, ` +
            `loosening creases [${[...mask.passiveCreases].join(", ")}]`);
        console.log(`Other 10 candidate masks in queue: `);
        for (let i = 0; i < Math.min(10, mq.masks.length); i++){
            let m = mq.masks[i];
            console.log(`  mask ${i + 1}: vanishing crease ${m.activeCrease}, ` +
                `loosening creases [${[...m.passiveCreases].join(", ")}]`);
        }
        globals.model.getSolver().reset();
        globals.creaseMaterialHasChanged = true;
        // Wait for the next call to InstabilityTestLoop
        return (isStable) => {
            if (isStable) {
                console.log("Mask resulted in stable configuration.");
                applyMask();
                globals.creaseMaterialHasChanged = true;
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
        console.log(`Applying mask: vanishing crease ${globals.mask.activeCrease}:` +
            `${creases[globals.mask.activeCrease].getTheta()})`);
        console.log(globals.mask);
        creases[globals.mask.activeCrease].setTargetTheta(0);
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

    function getInstabilities(){
        var creases = globals.model.getCreases();
        let actualThetas = globals.model.getSolver().getTheta();
        let instabilities = [];
        for (let i = 0; i < creases.length; i++){
            let instability =
                creases[i].getK() *
                (isPassiveCrease(i) ? 0 : 1) *
                ((actualThetas[i] - 
                    (isActiveCrease(i) ? 0 : creases[i].getTheta())
                ) ** 2);
            instabilities.push(instability);
        }
        return instabilities;
    }

    let callCount = 0;
    let stepper = null;

    let welfold = {
        mean: 0,
        var_: 100,
        cil: 0,
        ciu: 0,
        stabilized: false,
    }

    function solve() {
        callCount = (callCount + 1) % 10;
        const instabilities = getInstabilities();
        const instability = instabilities.reduce((a, b) => a + b, 0);
        
        const alpha = 0.2;

        const logInstability = () => {
            console.log(`Instability: ${instability.toFixed(5)} [${welfold.n} steps]`);
        };

        if (welfold.stabilized) {
            if (instability >= welfold.cil && instability <= welfold.ciu) {
                return;
            } else {
                logInstability();
                console.log("System destabilized, resuming monitoring...");
                welfold = {
                    mean: 0,
                    var_: 100,
                    cil: 0,
                    ciu: 0,
                    stabilized: false,
                }
            }
        }

        const old_mean = welfold.mean;
        welfold.mean = (1 - alpha) * welfold.mean + alpha * instability;
        welfold.var_ = (1 - alpha) * (welfold.var_ + alpha * (instability - old_mean) ** 2);
        const stddev = Math.sqrt(welfold.var_);
        welfold.cil = welfold.mean - 1.96 * (stddev / Math.sqrt(1 / alpha));
        welfold.ciu = welfold.mean + 1.96 * (stddev / Math.sqrt(1 / alpha));

        const containsZero = welfold.cil <= 0 && welfold.ciu >= 0;

        welfold.stabilized = welfold.var_ < 0.1;

        if (stepper && !containsZero) {
            stepper = stepper(false);
                welfold = {
                    mean: 0,
                    var_: 1e6,
                    cil: 0,
                    ciu: 0,
                    stabilized: false,
                }
        } else if (stepper && containsZero && welfold.stabilized) {
            stepper = stepper(true);
        };

        if (welfold.stabilized) {
            logInstability();
            console.log("System has stabilized, stopping monitoring...");
        };

        if (callCount === 0) {
            logInstability();
        }
    }

    function startStepper(){
        if (stepper) {
            console.log("Stepper already initialized.");
            return;
        }
        console.log("Initializing stepper...");
        mq = new MaskQueue();
        nodeCombinations = globals.model.getNodes().map(getNodeCombinations);
        stepper = stepFinderInit(0);
    }

    return {
        solve: solve,
        startStepper: startStepper,
        isActiveCrease: isActiveCrease,
        isPassiveCrease: isPassiveCrease,
    }
}