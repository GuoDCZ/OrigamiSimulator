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

    function isValleyAngle(angle){
        return isSmall(angle + Math.PI);
    }

    function isFlatAngle(angle){
        return isSmall(angle);
    }

    function combinations(arr, num){
        if (num === 0) return [[]];
        return arr.flatMap((head, i) => 
            combinations(arr.slice(i + 1), num - 1).map(comb => [head, ...comb])
        );
    }

    return null;
}