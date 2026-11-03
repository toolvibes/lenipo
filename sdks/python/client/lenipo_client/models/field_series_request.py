from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..models.series_field import SeriesField
from ..types import UNSET, Unset






T = TypeVar("T", bound="FieldSeriesRequest")



@_attrs_define
class FieldSeriesRequest:
    """ 
        Attributes:
            query (str):
            field (SeriesField | Unset):
            days (int | Unset):  Default: 30.
     """

    query: str
    field: SeriesField | Unset = UNSET
    days: int | Unset = 30
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        query = self.query

        field: str | Unset = UNSET
        if not isinstance(self.field, Unset):
            field = self.field.value


        days = self.days


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "query": query,
        })
        if field is not UNSET:
            field_dict["field"] = field
        if days is not UNSET:
            field_dict["days"] = days

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        query = d.pop("query")

        _field = d.pop("field", UNSET)
        field: SeriesField | Unset
        if isinstance(_field,  Unset):
            field = UNSET
        else:
            field = SeriesField(_field)




        days = d.pop("days", UNSET)

        field_series_request = cls(
            query=query,
            field=field,
            days=days,
        )


        field_series_request.additional_properties = d
        return field_series_request

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
