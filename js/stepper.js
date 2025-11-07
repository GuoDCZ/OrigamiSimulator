/**
 * Created by zhiyao on 11/6/25.
 */


function initStepper(globals){
  
    function isSmall(num, lv=2){
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

    function isFlatAngle(angle){
        return isSmall(angle);
    }

    function isFlatCrease(crease){
        return isFlatAngle(crease.getTargetTheta());
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
        var effectiveCreases = node.invCreases.filter(crease =>
            !isFlatCrease(crease)
        );
        effectiveCreases.forEach(crease => {
            if (!isFlatFoldingCrease(crease)) console.warn("Non-flat-folding crease found at node ", node.index);
        });
        if (effectiveCreases.length % 2 === 1) console.warn("Odd number of effective creases at node ", node.index);
        if (effectiveCreases.length === 0) console.warn("No effective creases at node ", node.index);
        if (effectiveCreases.length === 2) return [effectiveCreases];
        // effectiveCreases.length >= 4
        var homoPairs = [];
        var res = [];
        const comb2s = combinations(effectiveCreases, 2);
        for (let i = 0; i < effectiveCreases.length; i++){
            console.log("Direction of effective crease ", effectiveCreases[i].index, ": ", effectiveCreases[i].edge.getDirection());
        }
        for (let i = 0; i < comb2s.length; i++){
            let comb = comb2s[i];
            if (isParallelCreases(comb[0], comb[1])){
                if (isMountainCrease(comb[0]) == isMountainCrease(comb[1])){
                    console.log("Found homogeneous pair: ", comb[0].index, comb[1].index);
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
                console.log("Checking crease ", c.index, " against pair ", comb[0].index, comb[1].index);
                console.log("isMountainCrease(c): ", isMountainCrease(c), ", isMountainCrease(comb[0]): ", isMountainCrease(comb[0]));
                if (isMountainCrease(c) != isMountainCrease(comb[0])) {
                    console.log("Found non-homogeneous pair: ", comb[0].index, c.index);
                    res.push([...comb, c]);
                }
            }
        }
        for (let i = 4; i <= effectiveCreases.length; i++){
            res.push(...combinations(effectiveCreases, i));
        }
        return res;
    }

    return {
        getNodeCombinations: getNodeCombinations
    }
}