// Runs before paint to set the theme class from localStorage — prevents a flash
// of the wrong theme. Default is light (no class) when nothing is stored.
export const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light')t='light';if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`
