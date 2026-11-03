from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import Literal, cast
from uuid import UUID






T = TypeVar("T", bound="GadgetConfigType11")



@_attrs_define
class GadgetConfigType11:
    """ 
        Attributes:
            type_ (Literal['app']):
            app_id (UUID):
            module (str):
            config (str):  Default: ''.
     """

    type_: Literal['app']
    app_id: UUID
    module: str
    config: str = ''





    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        app_id = str(self.app_id)

        module = self.module

        config = self.config


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "type": type_,
            "appId": app_id,
            "module": module,
            "config": config,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        type_ = cast(Literal['app'] , d.pop("type"))
        if type_ != 'app':
            raise ValueError(f"type must match const 'app', got '{type_}'")

        app_id = UUID(d.pop("appId"))




        module = d.pop("module")

        config = d.pop("config")

        gadget_config_type_11 = cls(
            type_=type_,
            app_id=app_id,
            module=module,
            config=config,
        )

        return gadget_config_type_11

