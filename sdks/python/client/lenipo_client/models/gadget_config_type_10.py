from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from typing import Literal, cast

if TYPE_CHECKING:
  from ..models.report_config_type_0 import ReportConfigType0
  from ..models.report_config_type_1 import ReportConfigType1
  from ..models.report_config_type_10 import ReportConfigType10
  from ..models.report_config_type_11 import ReportConfigType11
  from ..models.report_config_type_2 import ReportConfigType2
  from ..models.report_config_type_3 import ReportConfigType3
  from ..models.report_config_type_4 import ReportConfigType4
  from ..models.report_config_type_5 import ReportConfigType5
  from ..models.report_config_type_6 import ReportConfigType6
  from ..models.report_config_type_7 import ReportConfigType7
  from ..models.report_config_type_8 import ReportConfigType8
  from ..models.report_config_type_9 import ReportConfigType9





T = TypeVar("T", bound="GadgetConfigType10")



@_attrs_define
class GadgetConfigType10:
    """ 
        Attributes:
            type_ (Literal['report']):
            report (ReportConfigType0 | ReportConfigType1 | ReportConfigType10 | ReportConfigType11 | ReportConfigType2 |
                ReportConfigType3 | ReportConfigType4 | ReportConfigType5 | ReportConfigType6 | ReportConfigType7 |
                ReportConfigType8 | ReportConfigType9):
     """

    type_: Literal['report']
    report: ReportConfigType0 | ReportConfigType1 | ReportConfigType10 | ReportConfigType11 | ReportConfigType2 | ReportConfigType3 | ReportConfigType4 | ReportConfigType5 | ReportConfigType6 | ReportConfigType7 | ReportConfigType8 | ReportConfigType9





    def to_dict(self) -> dict[str, Any]:
        from ..models.report_config_type_0 import ReportConfigType0 # noqa: PLC0415
        from ..models.report_config_type_1 import ReportConfigType1 # noqa: PLC0415
        from ..models.report_config_type_10 import ReportConfigType10 # noqa: PLC0415
        from ..models.report_config_type_11 import ReportConfigType11 # noqa: PLC0415
        from ..models.report_config_type_2 import ReportConfigType2 # noqa: PLC0415
        from ..models.report_config_type_3 import ReportConfigType3 # noqa: PLC0415
        from ..models.report_config_type_4 import ReportConfigType4 # noqa: PLC0415
        from ..models.report_config_type_5 import ReportConfigType5 # noqa: PLC0415
        from ..models.report_config_type_6 import ReportConfigType6 # noqa: PLC0415
        from ..models.report_config_type_7 import ReportConfigType7 # noqa: PLC0415
        from ..models.report_config_type_8 import ReportConfigType8 # noqa: PLC0415
        from ..models.report_config_type_9 import ReportConfigType9 # noqa: PLC0415
        type_ = self.type_

        report: dict[str, Any]
        if isinstance(self.report, ReportConfigType0):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigType1):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigType2):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigType3):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigType4):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigType5):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigType6):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigType7):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigType8):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigType9):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigType10):
            report = self.report.to_dict()
        else:
            report = self.report.to_dict()



        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "report": report,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.report_config_type_0 import ReportConfigType0 # noqa: PLC0415
        from ..models.report_config_type_1 import ReportConfigType1 # noqa: PLC0415
        from ..models.report_config_type_10 import ReportConfigType10 # noqa: PLC0415
        from ..models.report_config_type_11 import ReportConfigType11 # noqa: PLC0415
        from ..models.report_config_type_2 import ReportConfigType2 # noqa: PLC0415
        from ..models.report_config_type_3 import ReportConfigType3 # noqa: PLC0415
        from ..models.report_config_type_4 import ReportConfigType4 # noqa: PLC0415
        from ..models.report_config_type_5 import ReportConfigType5 # noqa: PLC0415
        from ..models.report_config_type_6 import ReportConfigType6 # noqa: PLC0415
        from ..models.report_config_type_7 import ReportConfigType7 # noqa: PLC0415
        from ..models.report_config_type_8 import ReportConfigType8 # noqa: PLC0415
        from ..models.report_config_type_9 import ReportConfigType9 # noqa: PLC0415
        d = dict(src_dict)
        type_ = cast(Literal['report'] , d.pop("type"))
        if type_ != 'report':
            raise ValueError(f"type must match const 'report', got '{type_}'")

        def _parse_report(data: object) -> ReportConfigType0 | ReportConfigType1 | ReportConfigType10 | ReportConfigType11 | ReportConfigType2 | ReportConfigType3 | ReportConfigType4 | ReportConfigType5 | ReportConfigType6 | ReportConfigType7 | ReportConfigType8 | ReportConfigType9:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_type_0 = ReportConfigType0.from_dict(data)



                return componentsschemas_report_config_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_type_1 = ReportConfigType1.from_dict(data)



                return componentsschemas_report_config_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_type_2 = ReportConfigType2.from_dict(data)



                return componentsschemas_report_config_type_2
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_type_3 = ReportConfigType3.from_dict(data)



                return componentsschemas_report_config_type_3
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_type_4 = ReportConfigType4.from_dict(data)



                return componentsschemas_report_config_type_4
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_type_5 = ReportConfigType5.from_dict(data)



                return componentsschemas_report_config_type_5
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_type_6 = ReportConfigType6.from_dict(data)



                return componentsschemas_report_config_type_6
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_type_7 = ReportConfigType7.from_dict(data)



                return componentsschemas_report_config_type_7
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_type_8 = ReportConfigType8.from_dict(data)



                return componentsschemas_report_config_type_8
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_type_9 = ReportConfigType9.from_dict(data)



                return componentsschemas_report_config_type_9
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_type_10 = ReportConfigType10.from_dict(data)



                return componentsschemas_report_config_type_10
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_report_config_type_11 = ReportConfigType11.from_dict(data)



            return componentsschemas_report_config_type_11

        report = _parse_report(d.pop("report"))


        gadget_config_type_10 = cls(
            type_=type_,
            report=report,
        )

        return gadget_config_type_10

