import {test,expect} from '@playwright/test';
test('reference design comparison',async({browser},info)=>{
 test.skip(!process.env.REFERENCE_URL,'Set REFERENCE_URL to an isolated copy of the original UI.');
 const viewport=info.project.name==='mobile'?{width:390,height:844}:{width:1280,height:900};
 const report=[];
 for(const [name,url]of [['original',process.env.REFERENCE_URL+'/originsofbeauty'],['standalone',process.env.TEST_URL||'http://localhost:3001']]){
  const page=await browser.newPage({viewport});
  await page.addInitScript(()=>{const original=window.setInterval;window.setInterval=(callback,ms,...args)=>ms===3500?0:original(callback,ms,...args);});
  await page.goto(url);await expect(page.locator('.ob-reference-banner.active img')).toBeVisible();
  await expect(page.locator('a[href*="/products/"]').first()).toBeVisible();
  await expect(page.locator('.ob-home-category-slider a').first()).toBeVisible();
  await page.locator('img').evaluateAll(async images=>{for(const img of images){img.loading='eager';await img.decode().catch(()=>{});}});
  await page.screenshot({path:`artifacts/${name}-${info.project.name}.png`,fullPage:true});
  report.push(await page.locator('.ob-reference-hero').evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));
  await page.close();
 }
 expect(report[1]).toEqual(report[0]);
});
