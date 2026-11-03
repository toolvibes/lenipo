from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast

if TYPE_CHECKING:
  from ..models.gadget_config_input_type_0 import GadgetConfigInputType0
  from ..models.gadget_config_input_type_1 import GadgetConfigInputType1
  from ..models.gadget_config_input_type_10 import GadgetConfigInputType10
  from ..models.gadget_config_input_type_11 import GadgetConfigInputType11
  from ..models.gadget_config_input_type_2 import GadgetConfigInputType2
  from ..models.gadget_config_input_type_3 import GadgetConfigInputType3
  from ..models.gadget_config_input_type_4 import GadgetConfigInputType4
  from ..models.gadget_config_input_type_5 import GadgetConfigInputType5
  from ..models.gadget_config_input_type_6 import GadgetConfigInputType6
  from ..models.gadget_config_input_type_7 import GadgetConfigInputType7
  from ..models.gadget_config_input_type_8 import GadgetConfigInputType8
  from ..models.gadget_config_input_type_9 import GadgetConfigInputType9





T = TypeVar("T", bound="AddGadgetRequest")



@_attrs_define
class AddGadgetRequest:
    """ 
        Attributes:
            config (GadgetConfigInputType0 | GadgetConfigInputType1 | GadgetConfigInputType10 | GadgetConfigInputType11 |
                GadgetConfigInputType2 | GadgetConfigInputType3 | GadgetConfigInputType4 | GadgetConfigInputType5 |
                GadgetConfigInputType6 | GadgetConfigInputType7 | GadgetConfigInputType8 | GadgetConfigInputType9):
            column (int | Unset):  Default: 0.
            title (str | Unset):  Default: ''.
     """

    config: GadgetConfigInputType0 | GadgetConfigInputType1 | GadgetConfigInputType10 | GadgetConfigInputType11 | GadgetConfigInputType2 | GadgetConfigInputType3 | GadgetConfigInputType4 | GadgetConfigInputType5 | GadgetConfigInputType6 | GadgetConfigInputType7 | GadgetConfigInputType8 | GadgetConfigInputType9
    column: int | Unset = 0
    title: str | Unset = ''
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        from ..models.gadget_config_input_type_0 import GadgetConfigInputType0 # noqa: PLC0415
        from ..models.gadget_config_input_type_1 import GadgetConfigInputType1 # noqa: PLC0415
        from ..models.gadget_config_input_type_10 import GadgetConfigInputType10 # noqa: PLC0415
        from ..models.gadget_config_input_type_11 import GadgetConfigInputType11 # noqa: PLC0415
        from ..models.gadget_config_input_type_2 import GadgetConfigInputType2 # noqa: PLC0415
        from ..models.gadget_config_input_type_3 import GadgetConfigInputType3 # noqa: PLC0415
        from ..models.gadget_config_input_type_4 import GadgetConfigInputType4 # noqa: PLC0415
        from ..models.gadget_config_input_type_5 import GadgetConfigInputType5 # noqa: PLC0415
        from ..models.gadget_config_input_type_6 import GadgetConfigInputType6 # noqa: PLC0415
        from ..models.gadget_config_input_type_7 import GadgetConfigInputType7 # noqa: PLC0415
        from ..models.gadget_config_input_type_8 import GadgetConfigInputType8 # noqa: PLC0415
        from ..models.gadget_config_input_type_9 import GadgetConfigInputType9 # noqa: PLC0415
        config: dict[str, Any]
        if isinstance(self.config, GadgetConfigInputType0):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigInputType1):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigInputType2):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigInputType3):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigInputType4):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigInputType5):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigInputType6):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigInputType7):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigInputType8):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigInputType9):
            config = self.config.to_dict()
        elif isinstance(self.config, GadgetConfigInputType10):
            config = self.config.to_dict()
        else:
            config = self.config.to_dict()


        column = self.column

        title = self.title


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "config": config,
        })
        if column is not UNSET:
            field_dict["column"] = column
        if title is not UNSET:
            field_dict["title"] = title

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.gadget_config_input_type_0 import GadgetConfigInputType0 # noqa: PLC0415
        from ..models.gadget_config_input_type_1 import GadgetConfigInputType1 # noqa: PLC0415
        from ..models.gadget_config_input_type_10 import GadgetConfigInputType10 # noqa: PLC0415
        from ..models.gadget_config_input_type_11 import GadgetConfigInputType11 # noqa: PLC0415
        from ..models.gadget_config_input_type_2 import GadgetConfigInputType2 # noqa: PLC0415
        from ..models.gadget_config_input_type_3 import GadgetConfigInputType3 # noqa: PLC0415
        from ..models.gadget_config_input_type_4 import GadgetConfigInputType4 # noqa: PLC0415
        from ..models.gadget_config_input_type_5 import GadgetConfigInputType5 # noqa: PLC0415
        from ..models.gadget_config_input_type_6 import GadgetConfigInputType6 # noqa: PLC0415
        from ..models.gadget_config_input_type_7 import GadgetConfigInputType7 # noqa: PLC0415
        from ..models.gadget_config_input_type_8 import GadgetConfigInputType8 # noqa: PLC0415
        from ..models.gadget_config_input_type_9 import GadgetConfigInputType9 # noqa: PLC0415
        d = dict(src_dict)
        def _parse_config(data: object) -> GadgetConfigInputType0 | GadgetConfigInputType1 | GadgetConfigInputType10 | GadgetConfigInputType11 | GadgetConfigInputType2 | GadgetConfigInputType3 | GadgetConfigInputType4 | GadgetConfigInputType5 | GadgetConfigInputType6 | GadgetConfigInputType7 | GadgetConfigInputType8 | GadgetConfigInputType9:
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_input_type_0 = GadgetConfigInputType0.from_dict(data)



                return componentsschemas_gadget_config_input_type_0
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_input_type_1 = GadgetConfigInputType1.from_dict(data)



                return componentsschemas_gadget_config_input_type_1
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_input_type_2 = GadgetConfigInputType2.from_dict(data)



                return componentsschemas_gadget_config_input_type_2
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_input_type_3 = GadgetConfigInputType3.from_dict(data)



                return componentsschemas_gadget_config_input_type_3
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_input_type_4 = GadgetConfigInputType4.from_dict(data)



                return componentsschemas_gadget_config_input_type_4
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_input_type_5 = GadgetConfigInputType5.from_dict(data)



                return componentsschemas_gadget_config_input_type_5
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_input_type_6 = GadgetConfigInputType6.from_dict(data)



                return componentsschemas_gadget_config_input_type_6
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_input_type_7 = GadgetConfigInputType7.from_dict(data)



                return componentsschemas_gadget_config_input_type_7
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_input_type_8 = GadgetConfigInputType8.from_dict(data)



                return componentsschemas_gadget_config_input_type_8
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_input_type_9 = GadgetConfigInputType9.from_dict(data)



                return componentsschemas_gadget_config_input_type_9
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            try:
                if not isinstance(data, dict):
                    raise TypeError()
                componentsschemas_gadget_config_input_type_10 = GadgetConfigInputType10.from_dict(data)



                return componentsschemas_gadget_config_input_type_10
            except (TypeError, ValueError, AttributeError, KeyError):
                pass
            if not isinstance(data, dict):
                raise TypeError()
            componentsschemas_gadget_config_input_type_11 = GadgetConfigInputType11.from_dict(data)



            return componentsschemas_gadget_config_input_type_11

        config = _parse_config(d.pop("config"))


        column = d.pop("column", UNSET)

        title = d.pop("title", UNSET)

        add_gadget_request = cls(
            config=config,
            column=column,
            title=title,
        )


        add_gadget_request.additional_properties = d
        return add_gadget_request

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
