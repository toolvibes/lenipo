from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import Literal, cast






T = TypeVar("T", bound="GadgetConfigInputType0")



@_attrs_define
class GadgetConfigInputType0:
    """ 
        Attributes:
            type_ (Literal['filter-results']):
            query (str):
            limit (int | Unset):  Default: 10.
     """

    type_: Literal['filter-results']
    query: str
    limit: int | Unset = 10
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        query = self.query

        limit = self.limit


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "type": type_,
            "query": query,
        })
        if limit is not UNSET:
            field_dict["limit"] = limit

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['filter-results'] , d.pop("type"))
        if type_ != 'filter-results':
            raise ValueError(f"type must match const 'filter-results', got '{type_}'")

        query = d.pop("query")

        limit = d.pop("limit", UNSET)

        gadget_config_input_type_0 = cls(
            type_=type_,
            query=query,
            limit=limit,
        )


        gadget_config_input_type_0.additional_properties = d
        return gadget_config_input_type_0

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
