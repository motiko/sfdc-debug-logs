(function(){
document.addEventListener('keydown', keyDown, false);
var userId;
function inject(fn) {
    var script = document.createElement('script');
    script.setAttribute("type", "application/javascript");
    script.textContent = '(' + fn + ')();';
    document.body.appendChild(script); // run the script
    document.body.removeChild(script); // clean up
}

function sendBackUserId(){
    if(window.UserContext){
        window.postMessage({type:"userId",content:UserContext.userId},"*");
    }
}

window.addEventListener("message", function(event) {
    if(event.data.type === "userId"){
        userId = event.data.content;
    }
});

inject(sendBackUserId);

function keyDown(e){
    if(e.ctrlKey && e.altKey){
        if(e.keyCode === 68 ){
            document.location.assign("/setup/ui/listApexTraces.apexp?user_id="+ userId+"&user_logging=true");
        }
        if(e.keyCode === 79){
            document.location.assign("/p/setup/custent/CustomObjectsPage");
        }
    }
}
})();