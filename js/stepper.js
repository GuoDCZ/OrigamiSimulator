/**
 * Created by zhiyao on 11/6/25.
 */


function initStepper(){
  
    function isSmall(num, lv=5){
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

    return null;
}