function getApartList(data, domainUrl) {
    let urlList = []
    if (data) {
        for (let i = 0; i < data.length; i++) {
            let currentUrlValuer = domainUrl + data[i].getAtribute('href')

            urlList.push(currentUrlValuer)
        }
    }
    return urlList
}
export { getApartList }