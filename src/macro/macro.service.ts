import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import * as moment from 'moment';
import { TimeToLive, TimeTypeEnum } from '../enums/common.enum';
import { RedisKeys } from '../enums/redis-keys.enum';
import { MssqlService } from '../mssql/mssql.service';
import { UtilCommonTemplate } from '../utils/utils.common';
import { ForeignInvestmentIndexDto } from './dto/foreign-investment-index.dto';
import { IIndustryGDPValue } from './interfaces/industry-gdp-value.interface';
import { IPPIndusProductionIndexMapping, IPPIndustyMapping, IPPMostIndustryProductionMapping } from './mapping/ipp-industry.mapping';
import { GDPResponse } from './responses/gdp.response';
import { LaborForceResponse } from './responses/labor-force.response';
import { TotalInvestmentProjectsResponse } from './responses/total-invesment-project.response';

@Injectable()
export class MacroService {
  constructor(
    @Inject(CACHE_MANAGER)
    private readonly redis: Cache,
    private readonly mssqlService: MssqlService,
  ) {}

  async industryGDPValue(): Promise<GDPResponse[]> {
    const redisData = await this.redis.get<GDPResponse[]>(
      RedisKeys.industryGDPValue,
    );
    if (redisData) return redisData;

    const query: string = `
        SELECT  [chiTieu]   as [name]
                ,[thoiDiem] as [date]
                ,[giaTri]   as [value]
        FROM [macroEconomic].[dbo].[DuLieuViMo]
        WHERE chiTieu IN ( 
            N'Giá trị GDP (2010) : Công nghiệp (Tỷ VNĐ)', 
            N'Giá trị GDP (2010) : Dịch vụ (Tỷ VNĐ)', 
            N'Giá trị GDP (2010) : Nông nghiệp (Tỷ VNĐ)' 
        )
        AND thoiDiem >= '2013-01-01'
        ORDER BY chiTieu, thoiDiem; 
    `;

    const data = await this.mssqlService.query<IIndustryGDPValue[]>(query);

    const mappedData = new GDPResponse().mapToList(data);

    await this.redis.set(RedisKeys.industryGDPValue, mappedData, {
      ttl: TimeToLive.OneWeek,
    });

    return mappedData;
  }

  async gdpPrice(): Promise<GDPResponse[]> {
    const redisData = await this.redis.get<GDPResponse[]>(RedisKeys.gdpPrice);
    if (redisData) return redisData;

    const query: string = `
        SELECT  [chiTieu] as name
            ,[thoiDiem] as date
            ,[giaTri]   as value
        FROM [macroEconomic].[dbo].[EconomicVN]
        WHERE chiTieu IN ( 
            N'GDP theo giá cố định (2010) (Tỷ VNĐ)', 
            N'GDP theo giá hiện hành (Tỷ VNĐ)'
        )
        AND thoiDiem >= '2013-01-01'
        ORDER BY chiTieu, thoiDiem; 
    `;

    const data = await this.mssqlService.query<IIndustryGDPValue[]>(query);

    const mappedData = new GDPResponse().mapToList(data);

    await this.redis.set(RedisKeys.gdpPrice, mappedData, {
      ttl: TimeToLive.OneWeek,
    });

    return mappedData;
  }

  async idustryGDPContibute(): Promise<GDPResponse[]> {
    const redisData = await this.redis.get<GDPResponse[]>(
      RedisKeys.idustryGDPContibute,
    );
    if (redisData) return redisData;

    const query: string = `
        WITH groupData AS
        (
            SELECT  [chiTieu]  AS [name]
                ,[thoiDiem] AS [date]
                ,[giaTri]   AS [value]
            FROM [macroEconomic].[dbo].[DuLieuViMo]
            WHERE [chiTieu] IN ( N'Giá trị GDP (2010) : Công nghiệp (Tỷ VNĐ)', N'Giá trị GDP (2010) : Dịch vụ (Tỷ VNĐ)', N'Giá trị GDP (2010) : Nông nghiệp (Tỷ VNĐ)' )
            AND [thoiDiem] >= '2013-01-01' 
        ), cancultaedData AS
        (
            SELECT  [name]
                ,[date]
                ,(SUM([value])over( PARTITION by [name],[date] ) / sum ([value]) over( PARTITION by [date] )) * 100 AS value
            FROM groupData
        )
        SELECT  [name]
            ,[date]
            ,[value]
        FROM cancultaedData
        ORDER BY [name], [date];
    `;

    const data = await this.mssqlService.query<IIndustryGDPValue[]>(query);

    const mappedData = new GDPResponse().mapToList(data);

    await this.redis.set(RedisKeys.idustryGDPContibute, mappedData, {
      ttl: TimeToLive.OneWeek,
    });

    return mappedData;
  }

  async idustryGDPGrowth(order: number): Promise<GDPResponse[]> {
    const redisData = await this.redis.get<GDPResponse[]>(
      `${RedisKeys.idustryGDPGrowth}:${order}`,
    );
    if (redisData) return redisData;

    const date = UtilCommonTemplate.getPastDateV2(2, order);

    const { dateFilter } = UtilCommonTemplate.getDateFilterV2(date);

    const query: string = `
        SELECT  [chiTieu]     AS [name]
            ,[thoiDiem]    AS [date]
            ,AVG([giaTri]) AS [value]
        FROM [macroEconomic].[dbo].[DuLieuViMo]
        WHERE phanBang = 'GDP'
        AND thoiDiem IN ${dateFilter}
        AND nhomDulieu = N'Tăng trưởng GDP theo giá 2010'
        GROUP BY  [chiTieu]
                ,[thoiDiem]
        ORDER BY [name]
                ,[date]
    `;

    const data = await this.mssqlService.query<IIndustryGDPValue[]>(query);

    const mappedData = new GDPResponse().mapToList(data);

    await this.redis.set(`${RedisKeys.idustryGDPGrowth}:${order}`, mappedData, {
      ttl: TimeToLive.OneWeek,
    });

    return mappedData as any;
  }

  async idustryGDPGrowthPercent(): Promise<GDPResponse[]> {
    const redisData = await this.redis.get<GDPResponse[]>(
      RedisKeys.idustryGDPGrowthPercent,
    );
    if (redisData) return redisData;

    const query: string = `
        SELECT  [chiTieu]  AS [name]
              ,[thoiDiem] AS [date]
              ,([giaTri] - lag([giaTri]) over ( partition by [chiTieu] ORDER BY [thoiDiem] )) 
                      / lag(ABS([giaTri])) over ( partition by [chiTieu] ORDER BY [thoiDiem] ) AS [value]
        FROM [macroEconomic].[dbo].[DuLieuViMo]
        WHERE [thoiDiem] >= '2013-03-01 00:00:00.000'
        AND phanBang = 'GDP'
        AND [chiTieu] IN ( 
              N'Công nghiệp chế biến, chế tạo', 
              N'Hoạt động kinh doanh bất động sản ', 
              N'Vận tải, kho bãi', N'Xây dựng', 
              N'Khai khoáng',
              N'Bán buôn và bán lẻ; sửa chữa ô tô, mô tô, xe máy và xe có động cơ khác ' )
        ORDER BY [name] , [date];
    `;

    const data = await this.mssqlService.query<IIndustryGDPValue[]>(query);

    const mappedData = new GDPResponse().mapToList(data);

    await this.redis.set(RedisKeys.idustryGDPGrowthPercent, mappedData, {
      ttl: TimeToLive.OneWeek,
    });

    return mappedData;
  }

  async idustryCPIPercent(): Promise<GDPResponse[]> {
    const redisData = await this.redis.get<GDPResponse[]>(
      RedisKeys.idustryCPIPercent,
    );
    if (redisData) return redisData;

    const query: string = `
      SELECT  [chiTieu]  AS [name]
            ,[thoiDiem] AS [date]
            ,[giaTri]   AS [value]
      FROM [macroEconomic].[dbo].[DuLieuViMo]
      WHERE phanBang = N'CHỈ SỐ GIÁ TIÊU DÙNG'
      AND [thoiDiem] >= '2018-01-01'
      AND [chiTieu] in (
          N'Tăng trưởng CPI :Hàng ăn và dịch vụ ăn uốngMoM (%)',
          N'Tăng trưởng CPI :Nhà ở và vật liệu xây dựngMoM (%)',
          N'Tăng trưởng CPI :Thiết bị và đồ dùng gia đìnhMoM (%)',
          N'Tăng trưởng CPI :Giao thôngMoM (%)',
          N'Tăng trưởng CPI :Giáo dụcMoM (%)'
      )
      ORDER BY [chiTieu], [thoiDiem];
    `;

    const data = await this.mssqlService.query<IIndustryGDPValue[]>(query);

    const mappedData = new GDPResponse().mapToList(data);

    await this.redis.set(RedisKeys.idustryCPIPercent, mappedData, {
      ttl: TimeToLive.OneWeek,
    });

    return mappedData;
  }

  async idustryCPITable(): Promise<GDPResponse[]> {
    const redisData = await this.redis.get<GDPResponse[]>(
      RedisKeys.idustryCPITable,
    );
    if (redisData) return redisData;

    const query: string = `
      SELECT  [chiTieu]  AS [name]
            ,[thoiDiem] AS [date]
            ,[giaTri]   AS [value]
      FROM [macroEconomic].[dbo].[DuLieuViMo]
      WHERE phanBang = N'CHỈ SỐ GIÁ TIÊU DÙNG'
      AND [thoiDiem] >= '2018-01-01'
      AND [chiTieu] in (
          N'Tăng trưởng CPI CPI :Chỉ số giá tiêu dùngMoM (%)',
          N'Tăng trưởng CPI :Lương thựcMoM (%)',
          N'Tăng trưởng CPI :Thực phẩmMoM (%)'
      )
      ORDER BY [chiTieu], [thoiDiem];
    `;

    const data = await this.mssqlService.query<IIndustryGDPValue[]>(query);

    const mappedData = new GDPResponse().mapToList(data);

    await this.redis.set(RedisKeys.idustryCPITable, mappedData, {
      ttl: TimeToLive.OneWeek,
    });

    return mappedData;
  }

  async idustryCPISameQuater(): Promise<GDPResponse[]> {
    const redisData = await this.redis.get<GDPResponse[]>(
      RedisKeys.idustryCPISameQuater,
    );
    if (redisData) return redisData;

    const date = UtilCommonTemplate.getPastDateV2(2, 1);

    const query: string = `
      SELECT  [chiTieu]  AS [name]
            ,[thoiDiem] AS [date]
            ,[giaTri]   AS [value]
      FROM [macroEconomic].[dbo].[DuLieuViMo]
      WHERE phanBang = N'CHỈ SỐ GIÁ TIÊU DÙNG'
      AND [thoiDiem] >= '${moment(date[1])
        .startOf('year')
        .format('YYYY-MM-DD')}' 
      AND [thoiDiem] <= '${moment(date[0]).endOf('year').format('YYYY-MM-DD')}'
      AND [chiTieu] = 
        N'Tăng trưởng CPI CPI :Chỉ số giá tiêu dùngMoM (%)'
      ORDER BY [chiTieu], [thoiDiem];
    `;

    const data = await this.mssqlService.query<IIndustryGDPValue[]>(query);

    const mappedData = new GDPResponse().mapToList(data);

    await this.redis.set(RedisKeys.idustryCPISameQuater, mappedData, {
      ttl: TimeToLive.OneWeek,
    });

    return mappedData;
  }

  async idustryCPIChange(order: number): Promise<GDPResponse[]> {
    const redisData = await this.redis.get<GDPResponse[]>(
      `${RedisKeys.idustryCPIChange}:${order}`,
    );
    if (redisData) return redisData;

    const date = UtilCommonTemplate.getPastDateV2(2, order);

    const { dateFilter } = UtilCommonTemplate.getDateFilterV2(date);

    const query: string = `
      SELECT  [chiTieu]  AS [name]
            ,[thoiDiem] AS [date]
            ,[giaTri]   AS [value]
      FROM [macroEconomic].[dbo].[DuLieuViMo]
      WHERE phanBang = N'CHỈ SỐ GIÁ TIÊU DÙNG'
      AND [thoiDiem] in ${dateFilter}
      AND [chiTieu] !=
          N'Tăng trưởng CPI CPI :Chỉ số giá tiêu dùngMoM (%)'
      ORDER BY [chiTieu], [thoiDiem];
    `;

    const data = await this.mssqlService.query<IIndustryGDPValue[]>(query);

    const mappedData = new GDPResponse().mapToList(data);

    await this.redis.set(`${RedisKeys.idustryCPIChange}:${order}`, mappedData, {
      ttl: TimeToLive.OneWeek,
    });

    return mappedData;
  }

  async cpiQuyenSo(): Promise<GDPResponse[]> {
    const redisData = await this.redis.get<GDPResponse[]>(RedisKeys.cpiQuyenSo);
    if (redisData) return redisData;

    const query: string = `
      select
          [Các nhóm hàng và dịch vụ] as [name],
          sum([Giai đoạn 2020-2025]) as value
      from  [macroEconomic].[dbo].[quyenso]
      where [Mã] is not null
      group by [Các nhóm hàng và dịch vụ]
    `;

    const data = await this.mssqlService.query<IIndustryGDPValue[]>(query);

    const mappedData = new GDPResponse().mapToList(data);

    await this.redis.set(RedisKeys.cpiQuyenSo, mappedData, {
      ttl: TimeToLive.OneWeek,
    });

    return mappedData;
  }

  private genIndustry(q: number){
    switch (q) {
      case 0:
        return 'Tăng trưởng: Toàn ngành công nghiệp (%)'
        case 1:
        return 'Tăng trưởng: Sản xuất và Phân phối điện (%)'
        case 2:
        return 'Tăng trưởng: Khai khoáng (%)'
        case 3:
        return 'Tăng trưởng: Cung cấp nước, hoạt động quản lý và xử lý rác thải, nước thải (%)'
        case 4:
        return 'Tăng trưởng: Công nghiệp chế biến, chế tạo (%)'
      default:
        break;
    }
  }

  async industrialIndex(q: number): Promise<GDPResponse[]> {
    const chiTieu = this.genIndustry(q)
    const redisData = await this.redis.get<GDPResponse[]>(
      `${RedisKeys.industrialIndex}:${q}`,
    );

    if (redisData) return redisData;

    const query: string = `
      SELECT  [chiTieu] as [name]
            ,[thoiDiem] as [date]
            ,[giaTri]    as[value]
      FROM [macroEconomic].[dbo].[DuLieuViMo]
      WHERE phanBang = N'CHỈ SỐ CÔNG NGHIỆP'
      AND chiTieu = N'${chiTieu}'
      AND nhomDuLieu = N'Tăng trưởng chung - cập nhập (MoM%)'
      AND thoiDiem >= '2013-01-01'
      ORDER BY thoiDiem;
    `;

    const data = await this.mssqlService.query<IIndustryGDPValue[]>(query);

    const mappedData = new GDPResponse().mapToList(data);

    await this.redis.set(`${RedisKeys.industrialIndex}:${q}`, mappedData, {
      ttl: TimeToLive.OneWeek,
    });

    return mappedData;
  }

  async industrialIndexTable(): Promise<GDPResponse[]> {
    const redisData = await this.redis.get<GDPResponse[]>(
      RedisKeys.industrialIndexTable,
    );
    if (redisData) return redisData;

    const query: string = `
      SELECT  [chiTieu] as [name]
            ,[thoiDiem] as [date]
            ,[giaTri]    as[value]
      FROM [macroEconomic].[dbo].[DuLieuViMo]
      WHERE phanBang = N'CHỈ SỐ CÔNG NGHIỆP'
      AND nhomDuLieu = N'Tăng trưởng chung - cập nhập (MoM%)'
      AND thoiDiem >= '2013-01-01'
      ORDER BY chiTieu desc, thoiDiem;
    `;

    const data = await this.mssqlService.query<IIndustryGDPValue[]>(query);

    const mappedData = new GDPResponse().mapToList(data);

    await this.redis.set(RedisKeys.industrialIndexTable, mappedData, {
      ttl: TimeToLive.OneWeek,
    });

    return mappedData;
  }

  async ippConsumAndInventory(industry: string): Promise<GDPResponse[]> {
    const industryFilter = IPPIndustyMapping[industry] || '';

    const redisData = await this.redis.get<GDPResponse[]>(
      `${RedisKeys.ippConsumAndInventory}:${industryFilter}`,
    );
    if (redisData) return redisData;

    const query: string = `
      SELECT 
          CASE 
              WHEN nhomDuLieu = N'CHỈ SỐ TIÊU THỤ SP CÔNG NGHIỆP (%)' THEN [chiTieu] + ' - TT'
              WHEN nhomDuLieu = N'CHỈ SỐ TỒN KHO SP CÔNG NGHIỆP (%)' THEN [chiTieu] + ' - TK'
              ELSE [chiTieu]
          END AS [name],
          [thoiDiem] AS [date],
          [giaTri] AS [value]
      FROM [macroEconomic].[dbo].[DuLieuViMo]
      WHERE phanBang = N'CHỈ SỐ CÔNG NGHIỆP'
          AND nhomDuLieu IN (
              N'CHỈ SỐ TIÊU THỤ SP CÔNG NGHIỆP (%)',
              N'CHỈ SỐ TỒN KHO SP CÔNG NGHIỆP (%)'
          )
          AND thoiDiem >= '2013-01-01'
      AND [chiTieu] = ${industryFilter}

      ORDER BY [chiTieu], [thoiDiem];
    `;

    const data = await this.mssqlService.query<IIndustryGDPValue[]>(query);

    const mappedData = new GDPResponse().mapToList(data);

    await this.redis.set(
      `${RedisKeys.ippConsumAndInventory}:${industryFilter}`,
      mappedData,
      {
        ttl: TimeToLive.OneWeek,
      },
    );

    return mappedData;
  }

  async ippIndusProductionIndex(industry: string): Promise<GDPResponse[]> {
    const industryFilter = IPPIndusProductionIndexMapping[industry] || '';

    const redisData = await this.redis.get<GDPResponse[]>(
      `${RedisKeys.ippIndusProductionIndex}:${industryFilter}`,
    );
    if (redisData) return redisData;

    const query: string = `
      SELECT 
          [chiTieu] as [name],
          [thoiDiem] AS [date],
          [giaTri] AS [value]
      FROM [macroEconomic].[dbo].[DuLieuViMo]
      WHERE phanBang = N'CHỈ SỐ CÔNG NGHIỆP'
          AND nhomDuLieu = N'CHỈ SỐ SẢN XUẤT CÔNG NGHIỆP THEO NGÀNH CÔNG NGHIỆP (%)'
          AND thoiDiem >= '2013-01-01'
      AND [chiTieu] = ${industryFilter}
      ORDER BY [chiTieu] DESC, [thoiDiem];

    `;

    const data = await this.mssqlService.query<IIndustryGDPValue[]>(query);

    const mappedData = new GDPResponse().mapToList(data);

    await this.redis.set(
      `${RedisKeys.ippIndusProductionIndex}:${industryFilter}`,
      mappedData,
      {
        ttl: TimeToLive.OneWeek,
      },
    );

    return mappedData;
  }

  async ippMostIndusProduction(industry: string): Promise<GDPResponse[]> {
    const industryFilter = IPPMostIndustryProductionMapping[industry] || '';

    const redisData = await this.redis.get<GDPResponse[]>(
      `${RedisKeys.ippMostIndusProduction}:${industryFilter}`,
    );
    if (redisData) return redisData;

    const query: string = `
      SELECT 
          [chiTieu] as [name],
          [thoiDiem] AS [date],
          [giaTri] AS [value]
      FROM [macroEconomic].[dbo].[DuLieuViMo]
      WHERE phanBang = N'CHỈ SỐ CÔNG NGHIỆP'
          AND nhomDuLieu = N'Sản lượng công nghiệp một số sản phẩm'
          AND thoiDiem >= '2009-01-01'
          AND [chiTieu] = ${industryFilter}
      ORDER BY [chiTieu] DESC, [thoiDiem];
    `;

    const data = await this.mssqlService.query<IIndustryGDPValue[]>(query);

    const mappedData = new GDPResponse().mapToList(data);

    await this.redis.set(
      `${RedisKeys.ippMostIndusProduction}:${industryFilter}`,
      mappedData,
      {
        ttl: TimeToLive.OneWeek,
      },
    );

    return mappedData;
  }

  async laborForce(){
    const redisData = await this.redis.get(RedisKeys.laborForce)
    if(redisData) return redisData
    const query = `
        SELECT
          chiTieu AS name,
          thoiDiem AS date,
          giaTri AS value
        FROM macroEconomic.dbo.DuLieuViMo
        WHERE chiTieu IN (N'Lao động có việc ( triệu người)', N'Lực lượng lao động ( triệu người)')
        AND phanBang = N'LAO ĐỘNG'
        AND nhomDulieu = N'Chỉ tiêu lao động'
        ORDER BY date ASC
    `
    const data = await this.mssqlService.query<LaborForceResponse[]>(query)
    const dataMapped = LaborForceResponse.mapToList(data)
    await this.redis.set(RedisKeys.laborForce, dataMapped, {ttl: TimeToLive.OneWeek})
    return dataMapped
  }

  async unemployedRate(){
    const redisData = await this.redis.get(RedisKeys.unemployedRate)
    if(redisData) return redisData
    const query = `
      SELECT
        chiTieu AS name,
        thoiDiem AS date,
        giaTri AS value
      FROM macroEconomic.dbo.DuLieuViMo
      WHERE chiTieu IN (N'Tỷ lệ chung', N'Thanh niên', N'Thanh niên thành thị')
        AND phanBang = N'LAO ĐỘNG'
        AND nhomDulieu = N'Chỉ tiêu lao động'
      ORDER BY date ASC
    `
    const data = await this.mssqlService.query<LaborForceResponse[]>(query)
    const dataMapped = LaborForceResponse.mapToList(data)
    await this.redis.set(RedisKeys.unemployedRate, dataMapped, {ttl: TimeToLive.OneWeek})
    return dataMapped
  }

  async laborRate(){
    const redisData = await this.redis.get(RedisKeys.laborRate)
    if(redisData) return redisData
    const query = `
        SELECT TOP 3
          chiTieu AS name,
          thoiDiem AS date,
          giaTri AS value
        FROM macroEconomic.dbo.DuLieuViMo
        WHERE chiTieu IN (N'Công nghiệp- Xây dựng', N'Dịch vụ', N'Nông lâm ngư nghiệp')
          AND phanBang = N'LAO ĐỘNG'
          AND nhomDulieu = N'Chỉ tiêu lao động'
        ORDER BY date desc
    `
    const data = await this.mssqlService.query<LaborForceResponse[]>(query)
    const dataMapped = LaborForceResponse.mapToList(data)
    await this.redis.set(RedisKeys.laborRate, dataMapped, {ttl: TimeToLive.OneWeek})
    return dataMapped
  }

  async informalLaborRate(){
    const redisData = await this.redis.get(RedisKeys.informalLaborRate)
    if(redisData) return redisData
    const query = `
        SELECT top 1
          chiTieu AS name,
          thoiDiem AS date,
          giaTri AS value
        FROM macroEconomic.dbo.DuLieuViMo
        WHERE chiTieu IN (N'Tỉ lệ lao động phi chính thức (%)')
          AND phanBang = N'LAO ĐỘNG'
          AND nhomDulieu = N'Chỉ tiêu lao động'
        ORDER BY date desc
    `
    const data = await this.mssqlService.query<LaborForceResponse[]>(query)
    const dataMapped = LaborForceResponse.mapToList(data)
    await this.redis.set(RedisKeys.informalLaborRate, dataMapped, {ttl: TimeToLive.OneWeek})
    return dataMapped
  }

  async averageSalary(){
    const redisData = await this.redis.get(RedisKeys.averageSalary)
    if(redisData) return redisData
    const query = `
      SELECT
        chiTieu AS name,
        thoiDiem AS date,
        giaTri AS value
      FROM macroEconomic.dbo.DuLieuViMo
      WHERE chiTieu IN (N'Mức chung', N'Nam giới', N'Nữ giới')
        AND phanBang = N'LAO ĐỘNG'
        AND nhomDulieu = N'Chỉ tiêu lao động'
      ORDER BY date ASC
    `
    const data = await this.mssqlService.query<LaborForceResponse[]>(query)
    const dataMapped = LaborForceResponse.mapToList(data)
    await this.redis.set(RedisKeys.averageSalary, dataMapped, {ttl: TimeToLive.OneWeek})
    return dataMapped
  }

  async employmentFluctuations(){
    const redisData = await this.redis.get(RedisKeys.employmentFluctuations)
    if(redisData) return redisData
    const query = `
      SELECT top 10
        chiTieu AS name,
        thoiDiem AS date,
        giaTri AS value
      FROM macroEconomic.dbo.DuLieuViMo
      WHERE chiTieu IN (
            N'Bán buôn/Bán lẻ', 
            N'Chế biến/Chế tạo', N'Dịch vụ', N'F&B', N'Giáo dục', N'Khai khoáng', N'Khối Nhà nước', N'Xây dựng', N'Sản xuất, phân phối nước', N'Nghệ thuật')
        AND phanBang = N'LAO ĐỘNG'
        AND nhomDulieu = N'Chỉ tiêu lao động'
      ORDER BY date desc
    `
    const data = await this.mssqlService.query<LaborForceResponse[]>(query)
    const dataMapped = LaborForceResponse.mapToList(data)
    await this.redis.set(RedisKeys.employmentFluctuations, dataMapped, {ttl: TimeToLive.OneWeek})
    return dataMapped
  }

  async totalPayment(){
    const redisData = await this.redis.get(RedisKeys.totalPayment)
    if(redisData) return redisData
    const query = `
      SELECT
        chiTieu AS name,
        giaTri AS value,
        thoiDiem AS date
      FROM macroEconomic.dbo.DuLieuViMo
      WHERE chiTieu IN (
        N'Cung tiền M2 (Tỷ đồng)',
        N'Tiền gửi của các TCKT (Tỷ đồng)',
        N'Tiền gửi của dân cư (Tỷ đồng)'
        )
      AND phanBang = N'TÍN DỤNG'
      AND nhomDulieu = N'Chỉ số tín dụng'
    `

    const data = await this.mssqlService.query<LaborForceResponse[]>(query)
    const dataMapped = LaborForceResponse.mapToList(data)
    await this.redis.set(RedisKeys.totalPayment, dataMapped, {ttl: TimeToLive.OneWeek})
    return dataMapped
  }

  async totalPaymentPercent(){
    const redisData = await this.redis.get(RedisKeys.totalPaymentPercent)
    if(redisData) return redisData
    const query = `
      WITH tindung
      AS (SELECT
          'Tin dung (Ty dong)' AS name,
          SUM(giaTri) AS value,
          thoiDiem AS date
        FROM macroEconomic.dbo.DuLieuViMo
        WHERE chiTieu IN (
          N'Tiền gửi của các TCKT (Tỷ đồng)',
          N'Tiền gửi của dân cư (Tỷ đồng)'
      )
      AND phanBang = N'TÍN DỤNG'
      AND nhomDulieu = N'Chỉ số tín dụng'
      GROUP BY thoiDiem)
      SELECT
        chiTieu AS name,
        giaTri AS value,
        thoiDiem AS date
      FROM macroEconomic.dbo.DuLieuViMo
      WHERE chiTieu IN (
      N'Cung tiền M2 (Tỷ đồng)',
      N'Cung tiền M2 (%)'
      )
      AND phanBang = N'TÍN DỤNG'
      AND nhomDulieu = N'Chỉ số tín dụng'
      UNION ALL
      SELECT
        name,
        value,
        date
      FROM tindung
      UNION ALL
      SELECT
        'Tin dung (%)' AS name,
        ((value - LEAD(value) OVER (ORDER BY date DESC)) / LEAD(value) OVER (ORDER BY date DESC)) * 100 AS value,
        date
      FROM tindung
      ORDER BY date ASC
    `

    const data = await this.mssqlService.query<LaborForceResponse[]>(query)
    const dataMapped = LaborForceResponse.mapToList(data)
    await this.redis.set(RedisKeys.totalPaymentPercent, dataMapped, {ttl: TimeToLive.OneWeek})
    return dataMapped
  }

  async balancePaymentInternational(){
    const redisData = await this.redis.get(RedisKeys.balancePaymentInternational)
    if(redisData) return redisData
    const query = `
    SELECT
      chiTieu AS name,
      thoiDiem AS date,
      giaTri AS value
    FROM macroEconomic.dbo.DuLieuViMo
    WHERE phanBang = N'TÍN DỤNG'
      AND nhomDulieu = N'Chỉ số tín dụng'
      AND chiTieu IN (
      N'Cán cân vãng lai (Triệu USD)',
      N'Cán cân tài chính (Triệu USD)',
      N'Cán cân tổng thể (Triệu USD)',
      N'Dự trữ (Triệu USD)'
    )
    ORDER BY thoiDiem ASC
    `
    const data = await this.mssqlService.query<LaborForceResponse[]>(query)
    const dataMapped = LaborForceResponse.mapToList(data)
    await this.redis.set(RedisKeys.balancePaymentInternational, dataMapped, {ttl: TimeToLive.OneWeek})
    return dataMapped
  }

  async creditDebt(){
    const redisData = await this.redis.get(RedisKeys.creditDebt)
    if(redisData) return redisData
    const query = `
    SELECT
      chiTieu AS name,
      thoiDiem AS date,
      giaTri AS value
    FROM macroEconomic.dbo.DuLieuViMo
    WHERE phanBang = N'TÍN DỤNG'
      AND nhomDulieu = N'Chỉ số tín dụng'
      AND chiTieu IN (
      N'Công nghiệp (Tỷ đồng)',
      N'Xây dựng (Tỷ đồng)',
      N'Vận tải và Viễn thông (Tỷ đồng)',
      N'Nông nghiệp, lâm nghiệp và thuỷ sản (Tỷ đồng)',
      N'Các hoạt động dịch vụ khác (Tỷ đồng)'
      )
    ORDER BY thoiDiem ASC
    `
    const data = await this.mssqlService.query<LaborForceResponse[]>(query)
    const dataMapped = LaborForceResponse.mapToList(data)
    await this.redis.set(RedisKeys.creditDebt, dataMapped, {ttl: TimeToLive.OneWeek})
    return dataMapped
  }

  async creditDebtPercent(){
    const redisData = await this.redis.get(RedisKeys.creditDebtPercent)
    if(redisData) return redisData
    const query = `
    SELECT
      chiTieu AS name,
      thoiDiem AS date,
      giaTri AS value
    FROM macroEconomic.dbo.DuLieuViMo
    WHERE phanBang = N'TÍN DỤNG'
      AND nhomDulieu = N'Chỉ số tín dụng'
      AND chiTieu IN (
      N'Công nghiệp (%)',
      N'Xây dựng (%)',
      N'Vận tải và Viễn thông (%)',
      N'Nông nghiệp, lâm nghiệp và thuỷ sản (%)',
      N'Các hoạt động dịch vụ khác (%)'
      )
    ORDER BY thoiDiem ASC
    `
    const data = await this.mssqlService.query<LaborForceResponse[]>(query)
    const dataMapped = LaborForceResponse.mapToList(data)
    await this.redis.set(RedisKeys.creditDebtPercent, dataMapped, {ttl: TimeToLive.OneWeek})
    return dataMapped
  }

  async creditInstitution(){
    const redisData = await this.redis.get(RedisKeys.creditInstitution)
    if(redisData) return redisData
    const query = `
    SELECT
      chiTieu AS name,
      thoiDiem AS date,
      giaTri AS value
    FROM macroEconomic.dbo.DuLieuViMo
    WHERE phanBang = N'TÍN DỤNG'
      AND nhomDulieu = N'Chỉ số tín dụng'
      AND chiTieu IN (
      N'NHTM Nhà nước (%)',
      N'NHTM Cổ phần (%)',
      N'NH Liên doanh, nước ngoài (%)'
      )
    ORDER BY thoiDiem ASC
    `
    const data = await this.mssqlService.query<LaborForceResponse[]>(query)
    const dataMapped = LaborForceResponse.mapToList(data)
    await this.redis.set(RedisKeys.creditInstitution, dataMapped, {ttl: TimeToLive.OneWeek})
    return dataMapped
  }

  async totalInvestmentProjects(order: number){
    const redisData = await this.redis.get(`${RedisKeys.totalInvestmentProjects}:${order}`)
    if(redisData) return redisData
    let date = ''
    let group = ''
    switch (order) {
      case TimeTypeEnum.Month:
        date = `thoiDiem as date,`
        group = `group by thoiDiem, RIGHT(chiTieu, 4)`
        break
      case TimeTypeEnum.Quarter:
        date = `case datepart(qq, thoiDiem)
        when 1 then cast(datepart(year, thoiDiem) as varchar) + '/03/31'
        when 2 then cast(datepart(year, thoiDiem) as varchar) + '/06/30'
        when 3 then cast(datepart(year, thoiDiem) as varchar) + '/09/30'
        when 4 then cast(datepart(year, thoiDiem) as varchar) + '/12/31'
        end as date,`
        group = `group by datepart(qq, thoiDiem), datepart(year, thoiDiem), RIGHT(chiTieu, 4)`
        break 
        default:
    }
    const query = `
    SELECT
      ${date}
      SUM(giaTri) AS value,
      CASE
        WHEN RIGHT(chiTieu, 4) = '(CM)' THEN 'CM'
        WHEN RIGHT(chiTieu, 4) = '(TV)' THEN 'TV'
        WHEN RIGHT(chiTieu, 4) = '(GV)' THEN 'GV'
      END AS name

    FROM macroEconomic.dbo.DuLieuViMo
    WHERE phanBang = 'FDI'
      AND chiTieu LIKE '%(CM)'
      or chiTieu LIKE '%(TV)'
      or chiTieu LIKE '%(GV)'
      AND nhomDulieu = N'Chỉ số FDI'
    ${group}
    ORDER BY date ASC
    `
    
    const data = await this.mssqlService.query<TotalInvestmentProjectsResponse[]>(query)
    const dataMapped = TotalInvestmentProjectsResponse.mapToList(data)
    await this.redis.set(`${RedisKeys.totalInvestmentProjects}:${order}`, dataMapped, {ttl: TimeToLive.OneWeek})
    return dataMapped
  }

  async foreignInvestmentIndex(q: ForeignInvestmentIndexDto){
    const query = ``
    const data = await this.mssqlService.query(query)
    return data
  }
}