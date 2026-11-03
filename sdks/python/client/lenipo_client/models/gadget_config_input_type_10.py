from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from typing import Literal, cast

if TYPE_CHECKING:
  from ..models.report_config_input_type_0 import ReportConfigInputType0
  from ..models.report_config_input_type_1 import ReportConfigInputType1
  from ..models.report_config_input_type_10 import ReportConfigInputType10
  from ..models.report_config_input_type_11 import ReportConfigInputType11
  from ..models.report_config_input_type_2 import ReportConfigInputType2
  from ..models.report_config_input_type_3 import ReportConfigInputType3
  from ..models.report_config_input_type_4 import ReportConfigInputType4
  from ..models.report_config_input_type_5 import ReportConfigInputType5
  from ..models.report_config_input_type_6 import ReportConfigInputType6
  from ..models.report_config_input_type_7 import ReportConfigInputType7
  from ..models.report_config_input_type_8 import ReportConfigInputType8
  from ..models.report_config_input_type_9 import ReportConfigInputType9





T = TypeVar("T", bound="GadgetConfigInputType10")



@_attrs_define
class GadgetConfigInputType10:
    """ 
        Attributes:
            type_ (Literal['report']):
            report (ReportConfigInputType0 | ReportConfigInputType1 | ReportConfigInputType10 | ReportConfigInputType11 |
                ReportConfigInputType2 | ReportConfigInputType3 | ReportConfigInputType4 | ReportConfigInputType5 |
                ReportConfigInputType6 | ReportConfigInputType7 | ReportConfigInputType8 | ReportConfigInputType9):
     """

    type_: Literal['report']
    report: ReportConfigInputType0 | ReportConfigInputType1 | ReportConfigInputType10 | ReportConfigInputType11 | ReportConfigInputType2 | ReportConfigInputType3 | ReportConfigInputType4 | ReportConfigInputType5 | ReportConfigInputType6 | ReportConfigInputType7 | ReportConfigInputType8 | ReportConfigInputType9
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.report_config_input_type_0 import ReportConfigInputType0 # noqa: PLC0415
        from ..models.report_config_input_type_1 import ReportConfigInputType1 # noqa: PLC0415
        from ..models.report_config_input_type_10 import ReportConfigInputType10 # noqa: PLC0415
        from ..models.report_config_input_type_11 import ReportConfigInputType11 # noqa: PLC0415
        from ..models.report_config_input_type_2 import ReportConfigInputType2 # noqa: PLC0415
        from ..models.report_config_input_type_3 import ReportConfigInputType3 # noqa: PLC0415
        from ..models.report_config_input_type_4 import ReportConfigInputType4 # noqa: PLC0415
        from ..models.report_config_input_type_5 import ReportConfigInputType5 # noqa: PLC0415
        from ..models.report_config_input_type_6 import ReportConfigInputType6 # noqa: PLC0415
        from ..models.report_config_input_type_7 import ReportConfigInputType7 # noqa: PLC0415
        from ..models.report_config_input_type_8 import ReportConfigInputType8 # noqa: PLC0415
        from ..models.report_config_input_type_9 import ReportConfigInputType9 # noqa: PLC0415
        type_ = self.type_

        report: dict[str, Any]
        if isinstance(self.report, ReportConfigInputType0):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigInputType1):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigInputType2):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigInputType3):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigInputType4):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigInputType5):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigInputType6):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigInputType7):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigInputType8):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigInputType9):
            report = self.report.to_dict()
        elif isinstance(self.report, ReportConfigInputType10):
            report = self.report.to_dict()
        else:
            report = self.report.to_dict()



        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "report": report,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.report_config_input_type_0 import ReportConfigInputType0 # noqa: PLC0415
        from ..models.report_config_input_type_1 import ReportConfigInputType1 # noqa: PLC0415
        from ..models.report_config_input_type_10 import ReportConfigInputType10 # noqa: PLC0415
        from ..models.report_config_input_type_11 import ReportConfigInputType11 # noqa: PLC0415
        from ..models.report_config_input_type_2 import ReportConfigInputType2 # noqa: PLC0415
        from ..models.report_config_input_type_3 import ReportConfigInputType3 # noqa: PLC0415
        from ..models.report_config_input_type_4 import ReportConfigInputType4 # noqa: PLC0415
        from ..models.report_config_input_type_5 import ReportConfigInputType5 # noqa: PLC0415
        from ..models.report_config_input_type_6 import ReportConfigInputType6 # noqa: PLC0415
        from ..models.report_config_input_type_7 import ReportConfigInputType7 # noqa: PLC0415
        from ..models.report_config_input_type_8 import ReportConfigInputType8 # noqa: PLC0415
        from ..models.report_config_input_type_9 import ReportConfigInputType9 # noqa: PLC0415
        d = dict(src_dict)
        type_ = cast(Literal['report'] , d.pop("type"))
        if type_ != 'report':
            raise ValueError(f"type must match const 'report', got '{type_}'")

        def _parse_report(data: object) -> ReportConfigInputType0 | ReportConfigInputType1 | ReportConfigInputType10 | ReportConfigInputType11 | ReportConfigInputType2 | ReportConfigInputType3 | ReportConfigInputType4 | ReportConfigInputType5 | ReportConfigInputType6 | ReportConfigInputType7 | ReportConfigInputType8 | ReportConfigInputType9:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_input_type_0 = ReportConfigInputType0.from_dict(data)



                return componentsschemas_report_config_input_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_input_type_1 = ReportConfigInputType1.from_dict(data)



                return componentsschemas_report_config_input_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_input_type_2 = ReportConfigInputType2.from_dict(data)



                return componentsschemas_report_config_input_type_2
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_input_type_3 = ReportConfigInputType3.from_dict(data)



                return componentsschemas_report_config_input_type_3
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_input_type_4 = ReportConfigInputType4.from_dict(data)



                return componentsschemas_report_config_input_type_4
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_input_type_5 = ReportConfigInputType5.from_dict(data)



                return componentsschemas_report_config_input_type_5
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_input_type_6 = ReportConfigInputType6.from_dict(data)



                return componentsschemas_report_config_input_type_6
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_input_type_7 = ReportConfigInputType7.from_dict(data)



                return componentsschemas_report_config_input_type_7
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_input_type_8 = ReportConfigInputType8.from_dict(data)



                return componentsschemas_report_config_input_type_8
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_input_type_9 = ReportConfigInputType9.from_dict(data)



                return componentsschemas_report_config_input_type_9
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_report_config_input_type_10 = ReportConfigInputType10.from_dict(data)



                return componentsschemas_report_config_input_type_10
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_report_config_input_type_11 = ReportConfigInputType11.from_dict(data)



            return componentsschemas_report_config_input_type_11

        report = _parse_report(d.pop("report"))


        gadget_config_input_type_10 = cls(
            type_=type_,
            report=report,
        )


        gadget_config_input_type_10.additional_properties = d
        return gadget_config_input_type_10

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
