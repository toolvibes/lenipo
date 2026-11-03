from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import Literal, cast






T = TypeVar("T", bound="ReportConfigInputType0")



@_attrs_define
class ReportConfigInputType0:
    """ 
        Attributes:
            kind (Literal['cfd']):
            query (str):
            days (int | Unset):  Default: 30.
     """

    kind: Literal['cfd']
    query: str
    days: int | Unset = 30
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        kind = self.kind

        query = self.query

        days = self.days


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "kind": kind,
            "query": query,
        })
        if days is not UNSET:
            field_dict["days"] = days

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        kind = cast(Literal['cfd'] , d.pop("kind"))
        if kind != 'cfd':
            raise ValueError(f"kind must match const 'cfd', got '{kind}'")

        query = d.pop("query")

        days = d.pop("days", UNSET)

        report_config_input_type_0 = cls(
            kind=kind,
            query=query,
            days=days,
        )


        report_config_input_type_0.additional_properties = d
        return report_config_input_type_0

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
