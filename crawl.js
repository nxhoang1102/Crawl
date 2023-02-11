const puppeteer = require("puppeteer");
var elasticsearch = require("elasticsearch");
const fs = require("fs");
const path = require("path");
const uuid = require("uuid");

var objJson = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "./shopee.json"), "utf8")
);
var client = new elasticsearch.Client({ host: "localhost:9200", log: "trace" });
//hàm check kết nối tới elasticsearch
function TestConnect() {
  client.ping(
    {
      // ping usually has a 3000ms timeout
      requestTimeout: 1000,
    },
    function (error) {
      if (error) {
        console.trace("elasticsearch cluster is down!");
      } else {
        console.log("All is well");
      }
    }
  );
}
TestConnect();

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    defaultViewport: null,
    args: ["--start-maximized", "--no-sandbox", "--disable-gpu"],
    userDataDir: "C://chromium",
  });
  //const context=browser.defaultBrowserContext();
  //await context.overridePermissions('https://shopee.vn/Th%E1%BB%9Di-Trang-Nam-cat.78?page=1&sortBy=pop',['notifications']);
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });

  async function GetInfoProduct(urlProduct, index) {
    //biến lưu lại list thông tin sản phẩm với mỗi phần tử là 1 comment

    try {
      console.log("vào đây");
      var productInfo = await page.evaluate(
        async (urlProduct, index) => {
          try {
            //lấy về tiêu đề
            let lstInfoProduct = [];
            let title = "";
            if (document.querySelector("._44qnta") != null) {
              title = document.querySelector("._44qnta").textContent;
            }
            //lấy về điểm số chung
            let rating = "";
            if (document.querySelector("._1k47d8 ,._046PXf") != null) {
              rating = document.querySelector("._1k47d8 ,._046PXf").textContent;
            }
            //lấy về giá sản phẩm
            let price = "";
            if (document.querySelector(".pqTWkA") != null) {
              price = document.querySelector(".pqTWkA").textContent;
            }
            //lấy về thông tin sản phẩm
            let description = "";
            if (document.querySelector(".irIKAp") != null) {
              description = document.querySelector(".irIKAp").textContent;
            }
            //nếu sản phẩm có comment
            if (
              document.querySelector(
                ".shopee-button-solid,.shopee-button-solid--primary "
              ) != null
            ) {
              //khi trang hiện tại chưa phải trang cuối hoặc đã load được 10 trang comment
              let i = 0;
              while (
                document.querySelector(
                  ".shopee-button-solid,.shopee-button-solid--primary "
                ) !=
                  document.querySelectorAll(
                    ".product-ratings__page-controller >button"
                  )[
                    document.querySelectorAll(
                      ".product-ratings__page-controller >button"
                    ).length - 2
                  ] ||
                i < 10
              ) {
                let queryChildCommentDiv = document.querySelectorAll(
                  ".shopee-product-rating__main"
                );
                Array.prototype.map.call(queryChildCommentDiv, function (t) {
                  let content = "";
                  let contentDiv = t.querySelectorAll(
                    ".shopee-product-rating__main >div"
                  );
                  if (contentDiv.length > 2) {
                    content = contentDiv[2].textContent;
                  }
                  let querySelectRatting = Array.from(
                    t.querySelectorAll(
                      ".icon-rating-solid--active,.icon-rating-solid"
                    )
                  );
                  lstInfoProduct.push({
                    Url: urlProduct,
                    Title: title,
                    Rating: rating,
                    Price: price,
                    Description: description,
                    Comment: content,
                    Star: querySelectRatting.length,
                  });
                });
                i++;
                //next trang comment tiếp theo
                await document
                  .querySelector(".shopee-icon-button--right")
                  .click();
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
              //lấy comment trang cuối
              //comment đoạn trang cuối
              // await new Promise((resolve) => setTimeout(resolve, 1000));
              // let queryChildCommentDiv = document.querySelectorAll(
              //   ".shopee-product-rating__main"
              // );

              // Array.prototype.map.call(queryChildCommentDiv, function (t) {
              //   let content = "";
              //   if (t.querySelector(".shopee-product-rating__content") != null) {
              //     content = t.querySelector(
              //       ".shopee-product-rating__content"
              //     ).textContent;
              //   }
              //   let querySelectRatting = Array.from(
              //     t.querySelectorAll(
              //       ".icon-rating-solid--active,.icon-rating-solid"
              //     )
              //   );
              //   lstInfoProduct.push({
              //     Url: urlProduct,
              //     Title: title,
              //     Rating: rating,
              //     Price: price,
              //     Description: description,
              //     Comment: content,
              //     Star: querySelectRatting.length,
              //   });
              // });

              for (let i = lstInfoProduct.length - 1; i >= 0; i--) {
                if (
                  Object.values(lstInfoProduct[i])[5] == "" ||
                  Object.values(lstInfoProduct[i])[5] == null
                ) {
                  lstInfoProduct.splice(i, 1);
                }
              }
            }
            return lstInfoProduct;
          } catch (error) {
            console.log(error);
          }
        },
        urlProduct,
        index
      );
      return productInfo;
    } catch (err) {
      console.log(urlProduct);
      console.log(err);
    }
  }
  async function autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        var totalHeight = 0;
        var distance = 100;
        var timer = setInterval(() => {
          var scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  }
  function CreateIndex() {
    client.indices
      .exists({
        index: objJson.index_name,
      })
      .then(
        function (resp) {
          if (resp == true) {
            console.log("index already exists");
            client.indices.delete(
              {
                index: objJson.index_name,
              },
              function (err, res) {
                if (err) {
                  console.error(err.message);
                } else {
                  console.log("Indexes have been deleted!");
                  client.indices.create(
                    {
                      index: objJson.index_name,
                    },
                    function (err, resp, status) {
                      if (err) {
                        console.log(err);
                      } else {
                        console.log("create", resp);
                      }
                    }
                  );
                }
              }
            );
          } else {
            client.indices.create(
              {
                index: objJson.index_name,
              },
              function (err, resp, status) {
                if (err) {
                  console.log(err);
                } else {
                  console.log("create", resp);
                }
              }
            );
          }
        },
        function (err) {
          console.trace(err.message);
        }
      );
  }

  async function SaveData(productInfo) {
    try {
      let data = {
        Url: productInfo.Url,
        Title: productInfo.Title,
        Rating: productInfo.Rating,
        Price: productInfo.Price,
        Description: productInfo.Description,
        Comment: productInfo.Comment,
        Star: productInfo.Star,
      };
      console.log(data);
      var result = await client.index({
        index: objJson.index_name,
        type: "MenFashion",
        body: data,
      });
      console.log(result);
    } catch (err) {
      console.log(err);
    }
  }
  async function CrawlAllLinkPage() {
    try {
      await autoScroll(page);
      await page.waitForSelector(".shopee-icon-button--right");
      //await page.waitForSelector('._1gkBDw');
      let urls = [];
      i = 0;
      while (i < objJson.number_crawl_page) {
        await autoScroll(page);
        await page.waitForSelector(".shopee-icon-button--right");
        let url = await page.url();
        urls.push(url);
        i++;
        await page.click(".shopee-icon-button--right");
      }
      return urls;
    } catch (err) {
      console.log(err);
    }
  }
  var CrawlAllLinkProduct = async () => {
    try {
      await autoScroll(page);
      await page.waitForSelector(".shopee-icon-button--right");
      count = 0;
      countPoductInAPage = 0;
      do {
        await page.waitForSelector(".shopee-search-item-result__item");
        let allProductInPage = await page.$$(
          ".col-xs-2-4 ,.shopee-search-item-result__item"
        );
        countPoductInAPage = allProductInPage.length;
        await Promise.all([
          allProductInPage[count].click(),
          page.waitForNavigation({ waitUntil: "networkidle0" }),
        ]);

        await autoScroll(page);
        const urlProduct = await page.url();
        console.log(JSON.stringify(urlProduct));
        let testvalue = await GetInfoProduct(urlProduct, count);
        console.log(JSON.stringify(testvalue));
        if (testvalue != null) {
          for (let i = 0; i < testvalue.length; i++) {
            await SaveData(testvalue[i]);
          }
        }
        await page.goBack();
        console.log(
          "------------- complete product " + count + " ---------------"
        );
        count++;
      } while (count < 5);
    } catch (err) {
      console.log(err);
    }
  };
  CreateIndex();
  const linkConst = objJson.link;
  await page.goto(linkConst);
  //lấy tất cả link page 1,2,3 quy định theo params number_crawl_page
  let allLinkPage = await CrawlAllLinkPage();
  for (let i = 0; i < allLinkPage.length; i++) {
    await page.goto(allLinkPage[i]);
    await CrawlAllLinkProduct();
    console.log("*********** Finish page " + (i + 1) + " *************");
  }
  await browser.close();
})();
