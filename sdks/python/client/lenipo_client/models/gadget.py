from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.gadget_config_type_0 import GadgetConfigType0
  from ..models.gadget_config_type_1 import GadgetConfigType1
  from ..models.gadget_config_type_10 import GadgetConfigType10
  from ..models.gadget_config_type_11 import GadgetConfigType11
  from ..models.gadget_config_type_2 import GadgetConfigType2
  from ..models.gadget_config_type_3 import GadgetConfigType3
  from ..models.gadget_config_type_4 import GadgetConfigType4
  from ..models.gadget_config_type_5 import GadgetConfigType5
  from ..models.gadget_config_type_6 import GadgetConfigType6
  from ..models.gadget_config_type_7 import GadgetConfigType7
  from ..models.gadget_config_type_8 import GadgetConfigType8
  from ..models.gadget_config_type_9 import GadgetConfigType9





T = TypeVar("T", bound="Gadget")



@_attrs_define
class Gadget:
    """ 
        Attributes:
            id (UUID):
            title (str):
            config (GadgetConfigType0 | GadgetConfigType1 | GadgetConfigType10 | GadgetConfigType11 | GadgetConfigType2 |
                GadgetConfigType3 | GadgetConfigType4 | GadgetConfigType5 | GadgetConfigType6 | GadgetConfigType7 |
                GadgetConfigType8 | GadgetConfigType9):
     """

    id: UUID
    title: str
    config: GadgetConfigType0 | GadgetConfigType1 | GadgetConfigType10 | GadgetConfigType11 | GadgetConfigType2 | GadgetConfigType3 | GadgetConfigType4 | GadgetConfigType5 | GadgetConfigType6 | GadgetConfigType7 | GadgetConfigType8 | GadgetConfigType9





    def to_dict(self) -> dict[str, Any]:
        from ..models.gadget_config_type_0 import GadgetConfigType0 # noqa: PLC0415
        from ..models.gadget_config_type_1 import GadgetConfigType1 # noqa: PLC0415
        from ..models.gadget_config_type_10 import GadgetConfigType10 # noqa: PLC0415
        from ..models.gadget_config_type_11 import GadgetConfigType11 # noqa: PLC0415
        from ..models.gadget_config_type_2 import GadgetConfigType2 # noqa: PLC0415
        from ..models.gadget_config_type_3 import GadgetConfigType3 # noqa: PLC0415
        from ..models.gadget_config_type_4 import GadgetConfigType4 # noqa: PLC0415
        from ..models.gadget_config_type_5 import GadgetConfigType5 # noqa: PLC0415
        from ..models.gadget_config_type_6 import GadgetConfigType6 # noqa: PLC0415
        from ..models.gadget_config_type_7 import GadgetConfigType7 # noqa: PLC0415
        from ..models.gadget_config_type_8 import GadgetConfigType8 # noqa: PLC0415
        from ..models.gadget_config_type_9 import GadgetConfigType9 # noqa: PLC0415
        id = str(self.id)

        title = self.title

        config: dict[str, Any]
        if isinstance(self.config, GadgetConfigType0):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigType1):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigType2):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigType3):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigType4):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigType5):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigType6):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigType7):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigType8):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigType9):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigType10):
            config = self.config.to_dict()
        else:
            config = self.config.to_dict()



        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "title": title,
            "config": config,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.gadget_config_type_0 import GadgetConfigType0 # noqa: PLC0415
        from ..models.gadget_config_type_1 import GadgetConfigType1 # noqa: PLC0415
        from ..models.gadget_config_type_10 import GadgetConfigType10 # noqa: PLC0415
        from ..models.gadget_config_type_11 import GadgetConfigType11 # noqa: PLC0415
        from ..models.gadget_config_type_2 import GadgetConfigType2 # noqa: PLC0415
        from ..models.gadget_config_type_3 import GadgetConfigType3 # noqa: PLC0415
        from ..models.gadget_config_type_4 import GadgetConfigType4 # noqa: PLC0415
        from ..models.gadget_config_type_5 import GadgetConfigType5 # noqa: PLC0415
        from ..models.gadget_config_type_6 import GadgetConfigType6 # noqa: PLC0415
        from ..models.gadget_config_type_7 import GadgetConfigType7 # noqa: PLC0415
        from ..models.gadget_config_type_8 import GadgetConfigType8 # noqa: PLC0415
        from ..models.gadget_config_type_9 import GadgetConfigType9 # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        title = d.pop("title")

        def _parse_config(data: object) -> GadgetConfigType0 | GadgetConfigType1 | GadgetConfigType10 | GadgetConfigType11 | GadgetConfigType2 | GadgetConfigType3 | GadgetConfigType4 | GadgetConfigType5 | GadgetConfigType6 | GadgetConfigType7 | GadgetConfigType8 | GadgetConfigType9:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_type_0 = GadgetConfigType0.from_dict(data)



                return componentsschemas_gadget_config_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_type_1 = GadgetConfigType1.from_dict(data)



                return componentsschemas_gadget_config_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_type_2 = GadgetConfigType2.from_dict(data)



                return componentsschemas_gadget_config_type_2
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_type_3 = GadgetConfigType3.from_dict(data)



                return componentsschemas_gadget_config_type_3
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_type_4 = GadgetConfigType4.from_dict(data)



                return componentsschemas_gadget_config_type_4
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_type_5 = GadgetConfigType5.from_dict(data)



                return componentsschemas_gadget_config_type_5
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_type_6 = GadgetConfigType6.from_dict(data)



                return componentsschemas_gadget_config_type_6
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_type_7 = GadgetConfigType7.from_dict(data)



                return componentsschemas_gadget_config_type_7
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_type_8 = GadgetConfigType8.from_dict(data)



                return componentsschemas_gadget_config_type_8
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_type_9 = GadgetConfigType9.from_dict(data)



                return componentsschemas_gadget_config_type_9
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_type_10 = GadgetConfigType10.from_dict(data)



                return componentsschemas_gadget_config_type_10
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_gadget_config_type_11 = GadgetConfigType11.from_dict(data)



            return componentsschemas_gadget_config_type_11

        config = _parse_config(d.pop("config"))


        gadget = cls(
            id=id,
            title=title,
            config=config,
        )

        return gadget

