from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast
from uuid import UUID






T = TypeVar("T", bound="GadgetConfigType8")



@_attrs_define
class GadgetConfigType8:
    """ 
        Attributes:
            type_ (Literal['wiki-page']):
            page_id (UUID):
     """

    type_: Literal['wiki-page']
    page_id: UUID





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        page_id = str(self.page_id)


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "pageId": page_id,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['wiki-page'] , d.pop("type"))
        if type_ != 'wiki-page':
            raise ValueError(f"type must match const 'wiki-page', got '{type_}'")

        page_id = UUID(d.pop("pageId"))




        gadget_config_type_8 = cls(
            type_=type_,
            page_id=page_id,
        )

        return gadget_config_type_8

