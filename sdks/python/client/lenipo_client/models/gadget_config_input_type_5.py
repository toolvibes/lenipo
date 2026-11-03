from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import Literal, cast






T = TypeVar("T", bound="GadgetConfigInputType5")



@_attrs_define
class GadgetConfigInputType5:
    """ 
        Attributes:
            type_ (Literal['created-vs-resolved']):
            query (str):
            days (int | Unset):  Default: 30.
     """

    type_: Literal['created-vs-resolved']
    query: str
    days: int | Unset = 30
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        query = self.query

        days = self.days


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "query": query,
        })
        if days is not UNSET:
            field_dict["days"] = days

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['created-vs-resolved'] , d.pop("type"))
        if type_ != 'created-vs-resolved':
            raise ValueError(f"type must match const 'created-vs-resolved', got '{type_}'")

        query = d.pop("query")

        days = d.pop("days", UNSET)

        gadget_config_input_type_5 = cls(
            type_=type_,
            query=query,
            days=days,
        )


        gadget_config_input_type_5.additional_properties = d
        return gadget_config_input_type_5

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
